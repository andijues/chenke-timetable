# 在 Windows 安装晨课 iOS 版

已经生成未签名 IPA，不需要自己的 Mac。还需用自己的免费 Apple ID 签名到自己的 iPhone。安装后的免费签名有效期为 7 天，续签成功才能继续使用。

## 1. 准备安装包和工具

本机安装包：`output/晨课-iOS-未签名.ipa`，最低系统版本为 iOS 26.0。它不能直接在手机上点开安装。

在 [Sideloadly 官网](https://sideloadly.io/)下载 Windows 64 位版本。按官网要求准备 Windows 版 iTunes 和 iCloud；官网目前要求 Apple 网站版本，Microsoft Store 版本需按其说明处理。下载入口也在官网。

## 2. 签名安装

1. 用数据线连接 iPhone，解锁，并在手机上选择「信任这台电脑」。
2. 打开 Sideloadly，确认设备列表出现自己的 iPhone。
3. 把 `晨课-iOS-未签名.ipa` 拖进 Sideloadly。
4. 在 Sideloadly 输入自己的 Apple ID，保持普通 Apple ID 签名安装方式，点击 Start。按工具提示完成密码和双重认证；这些信息不需要发送到聊天里。
5. 等待工具明确显示安装成功。手机若提示未受信任的开发者，到「设置 → 通用 → VPN 与设备管理」信任自己的开发者账号。
6. 若系统要求开发者模式，到「设置 → 隐私与安全性 → 开发者模式」启用，并按系统提示重启确认。

如果报错，保留错误文本。安装成功和权限成功是两个不同的检查结果；源码云编译通过还不能证明手机已安装或闹钟会响。

## 3. 检查课表和闹钟

1. 打开晨课，在「设置」填写学校第 1 周的星期一、总周数和节次时间。
2. 从「导入」选择 PDF 或图片，校对课程名称、星期、时间与周次，确认后保存。示例课表不会发布闹钟。
3. 在「起床」设置提前量，例如 90 分钟；8:30 第一节晨课对应 7:00 起床。
4. 启用自动起床提醒，允许系统闹钟权限，检查页面是否明确显示系统已接受计划。
5. 执行「测试 1 分钟后响铃」，锁屏等待。确认声音和关闭操作；再检查退出应用后的行为。
6. 切换到下一天，核对无晨课日不会安排闹钟。修改课程或提前量后，检查系统同步反馈。

应用只排未来 28 天，打开或返回应用时续排。未确认的课程不进入闹钟计划；实际课表识别结果仍需校对。

请保持晨课应用未被隐藏、未被设置为“需要 Face ID/密码才能打开”。Apple 的 [AlarmKit 常见问题](https://developer.apple.com/forums/thread/797158)说明，这些应用保护状态会使 AlarmKit 闹钟失败。手机正常锁屏与应用自身要求认证是不同设置。

## 4. 免费续签

在 Sideloadly 中启用自动刷新。首次 USB 安装成功后，可按工具说明配置同一局域网的 Wi-Fi 连接；Windows 可能还需要 Bonjour。电脑或手机无法连接、刷新失败或账号权限失效时，需要重新签名。

续签时保持相同 Apple ID 和应用标识，避免重复安装成不同应用。先在晨课「设置」导出 JSON 备份，再处理重装或签名问题。

免费签名规则见 [Apple 开发者账号说明](https://developer.apple.com/help/account/basics/about-your-developer-account)；Windows 支持、免费账号与自动刷新流程见 [Sideloadly 官方说明](https://sideloadly.io/)。

## 构建证据与后续更新

源码：[andijues/chenke-timetable](https://github.com/andijues/chenke-timetable)。

最新成功构建：[GitHub Actions 运行记录](https://github.com/andijues/chenke-timetable/actions/runs/38575471683)，Xcode 26.6 / iOS 26.5 SDK，源码提交 `e5a77b64df753555579734148cf8da13ce64742e`。包含移动端输入、横屏、键盘弹窗、多行粘贴解析，以及原生闹钟调度队列修正。

下载包已通过 ZIP 完整性检查，哈希与云端上传记录一致。IPA 内含 arm64 iPhone 程序、AlarmKit 及 224 个共享界面/离线资源文件；没有 Apple 签名和安装描述文件。IPA 的 SHA-256 为：

```text
a3f110abe57e9a4dbcbf24084b31fce0b2a56d099974bc39c18774f36c9b7417
```

GitHub 构建产物只保留 1 天，本机下载的 IPA 可以长期保存。以后更新源码，可在仓库 Actions 手动运行「Build iOS unsigned IPA」，下载新的产物，继续用同一账号签名安装。

当前完成了云编译；个人签名、iPhone 安装及锁屏响铃还未经过实际验证。鸿蒙版已编译、签名、安装并确认主页可打开，系统提醒仍需开通代理提醒能力并验收。
