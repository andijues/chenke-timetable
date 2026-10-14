# 在 Windows 构建和安装晨课鸿蒙版

本项目为鸿蒙原生 HAP 工程，针对用户的鸿蒙 7 更新，目标 API 26，最低 API 20。当前源码已更新；官方 SDK 编译、个人签名及手机锁屏响铃尚待验证。本文说明实际构建流程，不把网页测试当成真机结果。

## 获取官方工具

1. 在 [华为下载中心](https://developer.huawei.com/consumer/cn/download/)用自己的实名认证开发者账号登录。
2. 下载 **Command Line Tools for Windows 26.0.0.851**。工具包约 2.5 GB，包含相应版本 SDK。
3. 按下载页的 SHA-256 校验工具包，再解压到不含中文或特殊符号的目录，例如 `D:\Plugin\HarmonyOS26`。保留完整目录层次。

官方工具获取和版本升级规则见 [命令行工具指南](https://developer.huawei.com/consumer/en/doc/harmonyos-guides/ide-commandline-get)与 [API 26 适配指南](https://developer.huawei.com/consumer/en/doc/harmonyos-releases/upgrade-adaptation)。

## 编译未签名 HAP

在课表项目目录运行：

```powershell
npm.cmd ci --ignore-scripts
npm.cmd run assets
npm.cmd run build
node scripts/build-harmony.mjs --tools "D:/Plugin/HarmonyOS26" --stage "D:/Plugin/HarmonyOSBuild"
python -X utf8 scripts/verify-harmony-artifact.py
```

脚本使用官方工具包里的 JDK、Node、Hvigor 和 SDK，在独立目录编译。它只生成未签名 HAP，保留源工程；不会把个人签名配置写进 Git 仓库，也不修改系统环境变量。

编译成功才会生成 `output/晨课-鸿蒙-未签名.hap` 和 `reports/harmony-build.json`。日志位于 `reports/harmony-build.log`。工具不完整或编译失败时，不会把源码改名成安装包。

如果已经装有对应版本的 DevEco Studio，也可用 `--tools` 指向其安装目录。实际工具包结构或 SDK 版本不同，可能需要调整构建配置；以真实编译结果为准。

## 给自己的手机签名安装

未签名 HAP 不能直接安装到鸿蒙手机。签名需关联自己的开发者账号和设备。

1. 下载官方 **DevEco Studio 26.0.0 Release**，安装后打开用于编译的独立工程。不要在准备公开的源码目录保存个人签名密码。
2. 用自己的华为开发者账号登录；工程的包名为 `com.andijues.chenke`。如创建自己的签名资料，需要与这个包名一致。
3. 在项目 **Signing Configs** 配置页启用 **Automatically generate signature**，选择自己的设备并完成签名。
4. 手机开启开发者选项与 USB 调试，连接 Windows，按系统提示允许连接。
5. 在 IDE 选择手机点击 Run，确认手机出现「晨课」，并能够打开首页。

签名文件、设备标识和密码保存在本机。调试签名有效期以华为平台实际显示为准，本文不预设期限。

## 导入与响铃验收

1. 在「设置」输入真实学期第 1 周的星期一、总周数和学校节次时间。
2. 导入 PDF 或图片，核对课程名称、星期、起止时间、周次，确认后保存。
3. 在「闹钟」设定提前量，例如第一节 8:30、提前 90 分钟，对应 7:00 起床。
4. 启用自动提醒，允许通知，检查是否显示系统已接受计划。拒绝权限时，页面会显示失败原因。
5. 执行「测试 1 分钟后提醒」，锁屏等待，检查铃声、关闭和稍后提醒。
6. 再分别检查退出应用、重启、静音/勿扰状态，以及无晨课、停课日和修改课程后的计划。

使用的是系统后台代理提醒，以具体日期发布，并采用闹钟声音通道。它的锁屏和勿扰表现仍需手机测试，不宣称会出现在华为「时钟」的手动闹钟列表中。

未来提醒窗口为 28 天。打开或返回应用时重新核对系统计划；更改提前量、课程和例外日期后会更新。演示和未确认的课程不会发布真实提醒。

## 本次更新与验证范围

- 修正已有提醒的查询接口，使用带提醒编号的结果，便于更新和撤销本应用的提醒。
- 增加通知权限状态检查及系统提醒数量超限的错误说明。
- 明确使用闹钟声音通道，保留一分钟测试与两次五分钟稍后提醒。
- 允许文件保存对话框打开期间更新或关闭起床提醒。
- 返回前台时重新同步，避免缓存让页面忽略系统权限变化。
- 返回授权对话框后保留一分钟测试，防止课程计划同步误取消测试提醒。
- 新增 Windows 命令行构建和 HAP 内容校验脚本。

当前通过 18 项规则/解析测试和 7 项浏览器检查；其中新增的是模拟鸿蒙桥接的前台返回、权限撤销与恢复流程。模拟桥接不等于设备 API、手机安装或实际响铃已经通过。
