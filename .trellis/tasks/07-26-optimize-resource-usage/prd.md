# Optimize project resource usage

## Goal

在保持项目现有对外功能、用户可见行为、数据兼容性和部署方式不变的前提下，降低 Docker/PostgreSQL 部署的运行时内存、CPU 与运行镜像体积，并用可重复的测量和回归测试证明优化有效且没有功能回退。

## Background

- 项目是 npm workspaces 管理的 TypeScript 全栈仓库，包含 `core`、`server-core`、`ui`、`local` 等包。
- 仓库同时支持 Docker/PostgreSQL 与 Cloudflare Workers/D1 部署；两者复用大部分订阅、加密和生成逻辑。
- 自动更新任务每 5 分钟触发。当前任务先读取所有已启用自动更新订阅的完整记录（包括可能很大的加密节点与配置字段），之后才在进程内判断哪些记录到期；未到期记录因此仍产生数据库读取、传输和驻留内存开销（`local/src/lib/auto-update-service.ts`）。
- 每次加密或解密字段都会重新执行 HKDF 密钥派生；单个订阅摘要需要解密多个字段，存在可测量的重复 CPU 开销（`packages/server-core/src/crypto/encrypted-field-v3.ts`、`local/src/lib/subscription-service.ts`）。
- 曾评估为 `/_next/static/` 增加显式 immutable 缓存规则；Next 生产构建对此给出“自定义 Cache-Control 可能破坏开发行为”的警告。该候选优化因此被证据否决，保留框架自身的静态资源缓存行为与现有配置。
- 订阅列表为了计算节点数和来源数会解密完整秘密字段；当前数据库模型没有冗余计数字段，因此若要彻底消除此开销会涉及数据模型与迁移，不属于默认的低风险首轮范围。
- 本地 Docker 对应的 Next standalone 基线构建成功：构建峰值 RSS 约 1.10 GiB、耗时 48.16 秒；standalone 逻辑体积约 74.0 MB（磁盘占用 78 MB），完整 `local/node_modules` 逻辑体积约 459.1 MB（磁盘占用 455 MB）。当前运行镜像同时复制两者，说明完整依赖树是镜像体积的主要可优化项。
- 加密微基线（Node、本机、64 KiB 负载、50 次加密 + 50 次解密）耗时约 312 ms；只派生一次并复用 AES key 的等价 Web Crypto 操作约 23 ms。后者未包含现有十六进制序列化成本，因此该数据仅证明重复 HKDF 是显著热点，不直接作为最终收益值。

## Requirements

- R1：建立可复现的优化前基线，并在相同条件下采集优化后数据；核心指标为运行时内存、CPU 与运行镜像体积，数据库 I/O 和静态请求量为支撑指标。
- R2：自动更新扫描未到期订阅时不得读取其加密 URL、节点、配置或订阅信息大字段；到期订阅仍按现有顺序和语义刷新。
- R3：相同 `ENCRYPTION_KEY` 下的并发及连续 v3 加解密应复用派生后的不可导出 `CryptoKey`；密钥变化、错误密钥、v2 兼容及 v3 密文格式行为保持不变，缓存不得随不同输入密钥无界增长。
- R4：不覆盖 Next 对 `/_next/static/` 的框架级缓存行为；API、页面和现有安全响应头保持不变，生产构建不得出现新增的自定义静态 Cache-Control 警告。
- R5：Docker 运行镜像不得再复制完整构建依赖树，只包含 Next standalone 运行闭包和执行启动迁移所需的最小锁定依赖集。
- R6：以 Docker/PostgreSQL 为首要验收环境；共享代码仍须保持 Cloudflare Workers/D1 构建与加密兼容，不得造成已知退化。
- R7：保持公开 API、生成结果、持久化数据格式、鉴权、定时任务、用户界面以及 Docker Compose 拓扑兼容，不引入新基础设施或外部服务。
- R8：保持现有启动迁移语义：应用容器仍在启动 Node 服务前执行 `prisma migrate deploy`。

## Acceptance Criteria

- [x] AC1（R1）：记录优化前后的环境、输入、命令和结果；至少 CPU/内存或运行镜像体积中的一个指标显著改善，且没有无法解释的明显退化。
- [x] AC2（R2）：测试证明首次扫描只选择调度元数据；没有到期项时不执行大字段查询，有到期项时只读取到期记录并保持现有汇总结果。
- [x] AC3（R3）：测试证明同一密钥只派生一次、并发调用共享派生结果、切换密钥仍可正确加解密且缓存保持单项；现有 v2/v3 兼容向量全部通过。
- [x] AC4（R4）：生产构建不包含自定义静态 Cache-Control 警告，且 `local/next.config.mjs` 的既有缓存与安全头配置无行为变化。
- [x] AC5（R5、R8）：构建后的运行镜像不含完整 `local/node_modules`，能够在 PostgreSQL 上执行 `prisma migrate deploy` 后启动服务；镜像体积与基线相比下降。
- [x] AC6（R6、R7）：lint、类型检查、单元测试、Docker Next 构建和 Worker 构建通过；API、配置/数据格式、生成输出和用户可见功能无已知变化。
- [x] AC7：所有改动均可通过普通代码回退，不包含数据库 schema 变更或不可逆迁移。

## Out of Scope

- 通过删除功能、降低正确性或改变默认行为来节省资源。
- 新增节点数/来源数持久化字段、数据库 schema 变更或数据回填；订阅列表的完整解密开销留待后续独立任务。
- 拆分独立迁移容器、改变 Compose 服务拓扑、大规模依赖替换或部署架构迁移。
- 仅凭主观判断、没有基线或验证数据的“优化”。
