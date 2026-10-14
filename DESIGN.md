---
name: "晨课 · 个人课表"
description: "本机课表的共享网页设计系统，以公共交通时间图组织课程与当前时刻。"
colors:
  green: "#164b42"
  green-hover: "#246252"
  bg: "#f5f7f6"
  surface: "#fff"
  ink: "#203b35"
  muted: "#64776f"
  line: "#e5ece8"
  mint: "#deeee2"
  sky: "#deedf5"
  lavender: "#e9e5f4"
  peach: "#f6e7d9"
  rose: "#f4e0e5"
  pointer: "#bf4565"
  mint-ink: "#254c35"
  sky-ink: "#234d62"
  lavender-ink: "#4e436c"
  peach-ink: "#6b4930"
  rose-ink: "#713b4b"
  bg-dark: "#14221e"
  surface-dark: "#1c2f28"
  ink-dark: "#e1eee5"
  muted-dark: "#a1b8a9"
  line-dark: "#30483d"
  green-dark: "#92c9aa"
  green-fill-dark: "#427e5d"
  green-hover-dark: "#528f6c"
  mint-dark: "#264536"
  sky-dark: "#273e4b"
  lavender-dark: "#3a324b"
  peach-dark: "#49382d"
  rose-dark: "#4b303b"
  pointer-dark: "#f28aa2"
  mint-ink-dark: "#c2e7ca"
  sky-ink-dark: "#c1deed"
  lavender-ink-dark: "#d9ceef"
  peach-ink-dark: "#f3dac7"
  rose-ink-dark: "#efd1dc"
typography:
  headline:
    fontFamily: "-apple-system,BlinkMacSystemFont,'HarmonyOS Sans SC','PingFang SC','Microsoft YaHei',sans-serif"
    fontSize: "30px"
    fontWeight: 650
    lineHeight: 1.35
    letterSpacing: "-.035em"
  headline-mobile:
    fontFamily: "-apple-system,BlinkMacSystemFont,'HarmonyOS Sans SC','PingFang SC','Microsoft YaHei',sans-serif"
    fontSize: "27px"
    fontWeight: 650
    lineHeight: 1.35
    letterSpacing: "-.035em"
  title:
    fontFamily: "-apple-system,BlinkMacSystemFont,'HarmonyOS Sans SC','PingFang SC','Microsoft YaHei',sans-serif"
    fontSize: "18px"
    fontWeight: 650
    lineHeight: 1.4
    letterSpacing: "-.015em"
  body:
    fontFamily: "-apple-system,BlinkMacSystemFont,'HarmonyOS Sans SC','PingFang SC','Microsoft YaHei',sans-serif"
    fontSize: "15px"
    fontWeight: 400
  field:
    fontFamily: "-apple-system,BlinkMacSystemFont,'HarmonyOS Sans SC','PingFang SC','Microsoft YaHei',sans-serif"
    fontSize: "16px"
    fontWeight: 400
  label:
    fontFamily: "-apple-system,BlinkMacSystemFont,'HarmonyOS Sans SC','PingFang SC','Microsoft YaHei',sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.7
  button:
    fontFamily: "-apple-system,BlinkMacSystemFont,'HarmonyOS Sans SC','PingFang SC','Microsoft YaHei',sans-serif"
    fontSize: "14px"
    fontWeight: 600
  text-button:
    fontFamily: "-apple-system,BlinkMacSystemFont,'HarmonyOS Sans SC','PingFang SC','Microsoft YaHei',sans-serif"
    fontSize: "13px"
    fontWeight: 600
  course-title:
    fontFamily: "-apple-system,BlinkMacSystemFont,'HarmonyOS Sans SC','PingFang SC','Microsoft YaHei',sans-serif"
    fontSize: "12px"
    fontWeight: 650
    lineHeight: 1.55
  course-title-mobile:
    fontFamily: "-apple-system,BlinkMacSystemFont,'HarmonyOS Sans SC','PingFang SC','Microsoft YaHei',sans-serif"
    fontSize: "13px"
    fontWeight: 650
    lineHeight: 1.6
  wake-time:
    fontFamily: "-apple-system,BlinkMacSystemFont,'HarmonyOS Sans SC','PingFang SC','Microsoft YaHei',sans-serif"
    fontSize: "32px"
    fontWeight: 650
    letterSpacing: "-.04em"
  lead-number:
    fontFamily: "-apple-system,BlinkMacSystemFont,'HarmonyOS Sans SC','PingFang SC','Microsoft YaHei',sans-serif"
    fontSize: "66px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-.04em"
  navigation:
    fontFamily: "-apple-system,BlinkMacSystemFont,'HarmonyOS Sans SC','PingFang SC','Microsoft YaHei',sans-serif"
    fontSize: "11px"
    fontWeight: 400
  navigation-active:
    fontFamily: "-apple-system,BlinkMacSystemFont,'HarmonyOS Sans SC','PingFang SC','Microsoft YaHei',sans-serif"
    fontSize: "11px"
    fontWeight: 650
rounded:
  course: "8px"
  course-mobile: "7px"
  field: "9px"
  button: "11px"
  surface: "14px"
  surface-mobile: "12px"
  floating: "18px"
  indicator: "3px"
spacing:
  gap-sm: "8px"
  gap-md: "12px"
  gap-lg: "16px"
  panel: "18px"
  gutter-mobile: "20px"
  section: "24px"
  workspace-gap: "32px"
  gutter-desktop: "42px"
components:
  button-primary:
    backgroundColor: "{colors.green}"
    textColor: "{colors.surface}"
    typography: "{typography.button}"
    rounded: "{rounded.button}"
    padding: "0 21px"
  button-primary-hover:
    backgroundColor: "{colors.green-hover}"
  button-primary-dark:
    backgroundColor: "{colors.green-fill-dark}"
    textColor: "{colors.surface}"
  button-primary-hover-dark:
    backgroundColor: "{colors.green-hover-dark}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.green}"
    typography: "{typography.button}"
    rounded: "{rounded.button}"
    padding: "0 21px"
  button-secondary-dark:
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.green-dark}"
  button-text:
    textColor: "{colors.green}"
    typography: "{typography.text-button}"
    padding: "0 6px"
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.field}"
    rounded: "{rounded.field}"
    padding: "11px 12px"
  input-field-dark:
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.ink-dark}"
  navigation:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.muted}"
    typography: "{typography.navigation}"
    rounded: "{rounded.floating}"
    padding: "8px 20px"
  navigation-active:
    textColor: "{colors.green}"
    typography: "{typography.navigation-active}"
  course-card:
    backgroundColor: "{colors.mint}"
    textColor: "{colors.mint-ink}"
    typography: "{typography.course-title}"
    rounded: "{rounded.course}"
    padding: "10px 7px"
  course-card-mobile:
    backgroundColor: "{colors.mint}"
    textColor: "{colors.mint-ink}"
    typography: "{typography.course-title-mobile}"
    rounded: "{rounded.course-mobile}"
    padding: "8px 6px"
  course-card-dark:
    backgroundColor: "{colors.mint-dark}"
    textColor: "{colors.mint-ink-dark}"
  schedule-surface:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.surface}"
    padding: "18px"
  schedule-surface-mobile:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.surface-mobile}"
    padding: "12px 9px"
  current-time-tag:
    backgroundColor: "{colors.pointer}"
    textColor: "{colors.surface}"
    rounded: "{rounded.indicator}"
    padding: "0 3px"
  import-dropzone:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.surface}"
    padding: "45px 18px"
---

# Design System: 晨课 · 个人课表

## Overview

**Creative North Star: "公共交通时间图"**

以校园里熟悉的公共交通时间图为视觉来源：横向排星期，纵向排真实时刻，课程块按上课时长占位。冷白画布、深松绿交互和淡色课程分组，让密集信息保持安静；粉红指针把“现在”落到同一坐标中。

界面以中文阅读和个人校正为中心。手机保留横向课表与固定时间轴，桌面增加今日安排；按钮、输入框、短说明和原文对照形成直接的操作关系。圆角用于界定可操作表面，细网格负责时间参照。

本文件记录共享网页界面，依据 src/main.mjs、public/style.css、index.html 和 .impeccable/review 中的明暗截图。鸿蒙已另行完成编译、签名、安装及主页启动验证；系统提醒仍待开放能力审批和响铃验收。iOS云编译已通过，手机安装及响铃未验证。系统成功状态必须来自原生回执，不能由视觉预览推定。

**Key Characteristics:**

- 二维时间坐标，课程位置和高度来自实际起止时间。
- 手机横向查看整周，固定时间轴与当前时间标签。
- 低饱和课程分组、深绿操作、粉红当前时刻。
- 中文系统字体、等宽数字、明暗主题和减少动效支持。
- 识别结果可校正，预览与系统调度状态有明确文字边界。

## Colors

深松绿承担操作和阅读重心，冷白承担画布，低饱和课程底色分组，饱和粉红定位当前时刻。frontmatter 中的颜色值是规范来源；带 `-dark` 的项对应源码的深色覆盖。

sidecar 的八步 OKLCH 色阶是按已用颜色生成的色板预览元数据，未加入应用 CSS，也不作为新的界面颜色；实际颜色以 frontmatter 和源码为准。

### Primary

- **深松绿**（`green`）：品牌标记、主要按钮、激活导航和重要时间。
- **松绿悬停**（`green-hover`）：浅色模式主要按钮的悬停状态。
- **夜间交互绿**（`green-dark`）：深色模式的可读文字与交互强调。按钮和今天日期的实色填充使用 **夜间按钮绿**（`green-fill-dark`），悬停使用对应项；不要直接用浅绿填白字按钮。

### Secondary

- **薄荷、天空蓝、浅紫、杏色、粉色**（`mint` / `sky` / `lavender` / `peach` / `rose`）：课程块、今日课程行和课程颜色选择。每个底色配合对应的 `*-ink` 文字，深色模式成对切换为 `*-dark` 与 `*-ink-dark`。
- **当前时刻粉红**（`pointer` / `pointer-dark`）：当前线、固定时间轴中的标签、三角与圆点。今天的列同时保留柔和绿色背景。
- 错误状态沿用粉色表面及其文字色；导入说明和演示条使用源码已有的柔和黄褐背景。状态语义以文字为准。

### Neutral

- **冷白画布与纸白表面**（`bg` / `surface`）：页面背景与可操作内容区域；深色模式使用对应夜间项。
- **深绿正文与灰绿辅助文字**（`ink` / `muted`）：内容层级；夜间正文和辅助文字采用各自的浅色项。
- **浅灰绿网格**（`line`）：小时网格、星期分隔、章节边界和列表分隔；夜间网格使用 `line-dark`。
- **课程文字**（`*-ink` / `*-ink-dark`）：与所属课程底色一起维护。不能只切换背景。

### Named Rules

**The Time Pointer Rule.** 饱和粉红用于当前时间线、时间标签、今天的三角和圆点；课程仍用淡色底和文字识别，主要操作保持绿色。

**The Honest Status Rule.** 柔和状态底色不能代替事实。网页起床预览、待确认课程、系统调度失败和原生返回的成功状态必须分别用文字表达；演示数据始终说明不会设置闹钟。

## Typography

**Display Font:** 未另设品牌展示字体；大号时间和提前分钟沿用界面字体。

**Body Font:** frontmatter 中的本机系统字体栈。苹果优先使用系统字体与 PingFang SC，鸿蒙使用可用的 HarmonyOS Sans SC，Windows 回退 Microsoft YaHei；具体命中字体取决于设备。

**Label/Mono Font:** 不另载等宽字体；数字通过 `font-variant-numeric: tabular-nums` 对齐。

**Character:** 中文界面保持直接、稳定。标题靠字号与字重形成层级，大号数字只服务于起床时刻和可调提前量；当前字体选择属于共享应用界面，不推导新的品牌展示字体规则。

### Hierarchy

- **Headline**（`headline`；手机 `headline-mobile`）：日期和页面标题，紧凑字距、较重字重。
- **Title**（`title`）：章节标题。课程编辑模态标题另使用源码现有的大一档字号。
- **Body / Field**（`body` / `field`）：基础界面字与表单输入。段落行高由对应组件决定，没有统一补造正文行高。
- **Label / Button**（`label` / `button` / `text-button`）：表单标签与动作；小屏主按钮和部分次要文字按实际媒体查询调整。
- **Course Title**（`course-title`；手机 `course-title-mobile`）：手机不压缩标题字号来塞入整周。手机课程地点与时间保留源码最终覆盖的（11px）字号。
- **Wake Time / Lead Number**（`wake-time` / `lead-number`）：起床建议与提前分钟的大号数字；手机起床数字另调整为（27px）。
- **Navigation**（`navigation` / `navigation-active`）：一级入口的普通与选中状态；手机标签字号为（12px）。

当前实现仍有（9–10px）的辅助注释和部分桌面课表元数据。它们作为既有可读性残留记录，未纳入复用 typography tokens；手机实机可读性仍待验证，不能因当前页面使用了小字就把它扩展为默认正文。

### Named Rules

**The Stable Numeral Rule.** 时钟、时间轴、起床时刻和提前分钟沿用界面字体，并保留 tabular-nums；不要用数字宽度变化制造视觉跳动。

## Layout

共享网页容器的最大宽度为（1260px），居中，桌面左右留白各（42px）。桌面课表工作区采用主列加（280px）今日安排侧栏，列间距为（32px）；导入、闹钟和设置也按源码采用对应双列。画布不是整屏卡片集合，主要空间留给课表和编辑内容。

在（980px）及以下，容器留白缩为（28px），工作区侧栏为（230px）、间距为（20px）。在（760px）及以下，主区域改为单列，左右留白为（20px），今日安排侧栏隐藏；底部导航铺满宽度，并保留顶部和底部安全区。桌面导航宽（420px）、高（70px）、距底（20px）；手机导航贴底，页面底部留足导航空间。

手机布局也适用于宽度不超过1000px且高度不超过500px的横屏，以及无悬停、粗指针设备。左右安全区参与内容和导航留白。输入文字统一16px；编辑弹窗按visualViewport可用高度滚动，底部操作保持可达；359px以下成对字段改为单列。键盘遮挡较大且输入获得焦点时暂时隐藏底部导航。

课表在桌面五日最小宽（420px）、七日最小宽（660px）；手机五日最小宽（560px）、七日最小宽（770px），以横向滚动保留课程列宽。手机时间轴宽（44px），桌面为（48px），均固定在滚动容器左侧；当前时间标签固定在同一轴中。不能把横向滚动处理成整页溢出。

课程以分钟为单位映射到纵坐标，网格默认覆盖（07:00–22:00），并根据课程和当前时刻扩展。运行时网格高度至少（600px），按每小时（50px）计算；宽桌面媒体查询另将高度设为（840px）。时刻线只出现在包含今天的可见周列内，每分钟更新；返回页面时重新渲染。课表的横向滚动位置在刷新中保留，首次打开定位今天。

课程编辑、表单和导入校对继承同一留白体系。前后周、今天、五日/七日、周/今日切换提供不同信息密度；手机保留滑动说明与点击可编辑说明。

## Elevation & Depth

主界面主要靠纸白表面、淡色块与细网格建立层次。课表和课程块没有投影。少量柔和阴影只用于分段选择、浮动底部导航和编辑对话框；当前时刻依赖线、标签和局部遮挡顺序，无需阴影。

### Shadow Vocabulary

- **分段选中**（`0 2px 5px #142e1f0a`）：表示已选视图。
- **桌面浮动导航**（`0 6px 28px #17372a14`）：将一级入口抬离课表。
- **手机贴底导航**（`0 -3px 20px #17372a09`）：保留轻微的顶部层次。
- **编辑模态**（`0 15px 65px #19332829`）：课程校对对话框；遮罩为（`#122c265e`）。

### Named Rules

**The Grid Stays Flat Rule.** 课表表面和课程块保持平面，以网格、淡色分组和当前时刻表达关系；阴影只承担已实现的分段选择、浮动导航与模态层级。

## Shapes

表面和控制使用小圆角：frontmatter 的 `surface` 界定主内容区，`button` 和 `field` 保持按钮及输入框可辨识，`course` 用于课程块。手机课表表面与课程块采用各自手机项。桌面导航与编辑对话框共享更大的浮动圆角；手机导航回到直边。

圆形只承担明确用途：今天日期、当前时刻圆点和开关滑块。开关触控区域47px × 44px，轨道47px × 28px居中、滑块22px；当前线1px、三角8px × 8px、圆点7px。未确认课程使用内侧虚线，导入区域使用虚线边界。

## Components

### Buttons

明确、可触达。主要按钮用深绿填白字，次按钮用纸白表面配绿字和细边，文字按钮用绿字与下划线悬停。普通主/次按钮最小高（46px），紧凑按钮及文字按钮最小高（44px）；图标按钮通常为（44px）。手机周导航已恢复到（44px）触控宽度。悬停、禁用和可见焦点均由源码控制；不要靠图标颜色独自传达动作。

### Cards / Containers

平面内容区域。课表表面的桌面与手机内边距使用对应 component tokens；课程块的颜色、文字色和圆角按课程配对。课程块按真实时长设置高度，至少（44px），名称允许换行。点击课程进入编辑；“待确认”同时出现于文字和虚线状态。今日课程列表补充起止时间、地点与待上课/进行中/已结束状态。

### Inputs / Fields

纸白背景、细灰绿边、小圆角和最小（44px）高度。标签在输入框上方，留（7px）间距；成对字段用于星期/周次、开始/结束时间。表单校验错误保留文字，并通过 alert 语义提示。课程颜色选择使用真正的 radio 输入和文字标签，不使用只靠颜色区分的无名控件。

颜色选项和确认动作至少44px可触达，长名称和地点可换行。导入复核在手机分行排列，编辑和移除动作保持44px高度。数值字段声明numeric输入模式；滑块高度44px。

### Navigation

四个一级入口：课表、导入、闹钟、设置。线条图标以 inline SVG 实现；选中项同时提高字重和描边，并保留可读名称与 aria-current。桌面居中浮动，手机贴底全宽。分段控件切换周课表与今日，选中项用表面与轻影区分。

### Import and Review

虚线导入区域让 PDF、扫描页和图片入口可见，支持本机选择和拖放；处理时展示进度，并禁用重复选择。粘贴文字是同页备用路径。识别列表展示建议课程、星期、时间、周次和校对理由，保留单项编辑、移除、补充以及原文展开。加入课表和确认课程是独立状态；视觉上不能把识别结果处理成已可靠生效。

### Wake Plan and Native Status

起床条先显示依据，再显示建议时刻与当前调度状态，点击进入闹钟页。提前分钟提供滑块和精确输入，示例展示时间换算。接下来一周按具体日期显示课程和起床时间，无晨课显示“休息”，未确认显示“待确认”。状态区域必须采用已有的 mode 分支及返回 message；网页模式展示预览文案，不展示系统调度成功。

### Current Position

当前指针由横线、今天列的三角与圆点、固定时间轴中的时间标签组成。它没有点击行为，不遮挡课程操作；回到今天可滚动定位。手机横向滑动后，时间标签与小时刻度仍留在视口左侧。

可见键盘焦点统一使用源码的（3px）绿色 outline 与（3px）外偏移；颜色选择和开关按其实际焦点规则处理。状态切换使用短时过渡；减少动效模式关闭 CSS 过渡与 CSS 平滑滚动，不新增长时入场效果。

## Do's and Don'ts

### Do:

- **Do** 保留星期 × 时间的二维关系，并按课程起止时间计算位置与高度。
- **Do** 在手机上保留横向滚动、固定时间轴、当前时间标签和滑动说明；五日与七日分别使用已实现的最小宽度。
- **Do** 让用户点击课程进入校对，保留名称、地点、星期、周次、起止时间、日期与确认状态。
- **Do** 用明确文字区分演示、网页预览、普通通知、系统代理提醒、系统闹钟与调度错误。
- **Do** 使用本机中文字体、等宽数字、可见键盘焦点，并响应深色主题和减少动效偏好。
- **Do** 在导入校对与危险操作中保留原文、警告和单独的操作入口。

### Don't:

- **Don't** 为塞下整周而缩窄手机课程列，或移除固定的时间参照。
- **Don't** 把演示、网页预览、日历导出或普通通知标成系统闹钟已设置。
- **Don't** 用课程颜色代替名称、时间、待确认文字或系统状态说明。
- **Don't** 把课表替换成装饰性统计卡片，让用户失去真实的星期和时刻位置。
- **Don't** 为界面字体增加联网依赖，或把现有过小的辅助文字固化成新增页面的默认字号。

