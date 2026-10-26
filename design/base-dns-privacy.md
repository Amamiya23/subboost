# 基础与 DNS：客户端维护 TUN 的隐私方案

## 已确认的需求

- 配置用于电脑、手机上的 Mihomo 客户端，TUN 由客户端维护。
- 日常访问域名的 DNS 查询统一经代理，代理不可用时不回退直连。
- 建立代理连接所需的节点域名解析单独使用加密 DNS；这是明确保留的引导解析例外。
- 保留已保存的自定义配置；新默认只用于新建或用户主动恢复默认。

## 配置行为

- 业务 DNS 使用 IP 地址形式的 DoH 上游，并显式指定 `#SubBoost DNS`。
- 只有配置引用该出口时，生成器才添加 `SubBoost DNS` 专用测速组，成员仅包含代理节点，排除 DIRECT 等非代理类型。
- 组内没有可用成员、provider 未加载或过滤后为空时，使用 `empty-fallback: REJECT`，不会采用 Mihomo 默认的 COMPATIBLE 回退。
- 引导 DNS 和节点域名解析使用 IP 地址形式的加密 DoH，不使用系统 DNS。默认不添加直连 fallback、不强制 HTTP/3。
- TUN 的 enable、stack、dns-hijack、strict-route 等由客户端管理，订阅不写入 TUN 配置。
- 默认关闭 allow-lan；默认对象和编辑器默认 YAML 来自同一个配置构建器。

## 编辑与校验

- YAML 仍是完整基础配置，显式输入不会自动与默认基础配置合并；清空不等于恢复默认。
- 编辑先保存在共享草稿中。应用前检查 YAML 语法、顶层映射、常用字段类型及端口范围，保留未知扩展字段。
- 应用失败保留输入及之前的有效预览。「取消」清除草稿，「恢复默认」只放入待审阅草稿。
- 草稿未应用时，生成、下载和保存会明确提示处理草稿，避免用户误以为改动已提交。
- 未应用草稿参与离开页面的修改检测，不写入订阅或浏览器持久存储。

## 防泄露范围与验收

这套方案控制的是 Mihomo 内置 DNS 的解析出口。开启 TUN 本身不证明整个设备无 DNS 泄露；客户端最终配置、路由接管及应用自带的加密 DNS 仍需验证。

- 在客户端确认 UDP/TCP 53 DNS 劫持生效；Windows 检查 strict-route 对多网卡 DNS 的防护。
- 检查浏览器安全 DNS、Android 私人 DNS，以及绕过 TUN 的应用和 IPv6 路由；不要将只关闭 DNS AAAA 响应视为完整 IPv6 防泄露。
- 用真实客户端检查最终配置和解析日志，再进行 DNS 泄露测试。测试出现的解析商也不能单独证明请求是否经过代理。
- 代理断开时，确认业务域名解析失败而非转为本地解析；引导节点域名的加密直连解析属于已确认例外。

官方依据：[TUN 与 DNS 劫持](https://wiki.metacubex.one/config/inbound/tun/)、[DNS 出口与节点域名解析](https://wiki.metacubex.one/config/dns/)、[代理组 empty-fallback](https://wiki.metacubex.one/en/config/proxy-groups/)。

## 验证记录

- 全量 226 个测试文件、1316 项测试已核验：首次 1315 项通过，1 项创建测试目录联接受 Windows 沙箱权限限制；允许仅在项目临时目录创建联接后，该测试文件 2 项均通过。
- TypeScript 和变更文件 ESLint 通过。
- 浏览器验证非法端口拦截、草稿保护、阻止下载旧配置、自定义配置摘要、恢复默认后应用，以及实际 YAML 中 DNS 代理组与 REJECT 回退；桌面和 390px 窄屏已检查。
- 可视化包含 DNS 专用组、节点成员及正确组计数；其拖拽顺序与生成 YAML 一致，放到首位不会改变业务流量兜底。
- 使用 example.com 演示节点，未修改或提交真实订阅，未改变系统或客户端的 TUN 设置；未进行用户设备上的实际 DNS 泄露测试。

界面截图：[桌面](base-dns-privacy-desktop.png)、[手机](base-dns-privacy-mobile.png)。
