---
name: "晨课 · 个人课表"
description: "蓝白馆藏索引式课务界面：清楚读取课程、日期与起床计划。"
colors:
  primary: "#3157d5"
  primary-hover: "#2448bd"
  canvas: "#f4f6fb"
  surface: "#fff"
  ink: "#1b2438"
  muted: "#626f86"
  line: "#e0e5ef"
  soft: "#ebeff8"
  next-bg: "#202e55"
  next-ink: "#fff"
  next-muted: "#d0daf2"
  wake-bg: "#fff0ae"
  wake-ink: "#443a0a"
  danger: "#a22e45"
  mint: "#e4ebff"
  sky: "#e1eff8"
  lavender: "#ece7fa"
  peach: "#fff0d5"
  rose: "#f8e5ed"
  mint-ink: "#2b467c"
  sky-ink: "#28506e"
  lavender-ink: "#55447e"
  peach-ink: "#765015"
  rose-ink: "#743b56"
  primary-dark: "#a7bdff"
  primary-fill-dark: "#4268e1"
  primary-hover-dark: "#5176ec"
  canvas-dark: "#111827"
  surface-dark: "#1c2639"
  ink-dark: "#edf1fa"
  muted-dark: "#adb9ce"
  line-dark: "#33405a"
  soft-dark: "#27334c"
  next-bg-dark: "#253b70"
  next-muted-dark: "#d5dfff"
  wake-bg-dark: "#ead58a"
  wake-ink-dark: "#3c330a"
  danger-dark: "#ffc1d0"
  mint-dark: "#293959"
  sky-dark: "#243b4e"
  lavender-dark: "#39314d"
  peach-dark: "#453b29"
  rose-dark: "#49313f"
  mint-ink-dark: "#d1ddff"
  sky-ink-dark: "#c4e4f5"
  lavender-ink-dark: "#dfd3ff"
  peach-ink-dark: "#f6e3bc"
  rose-ink-dark: "#f7d1e3"
typography:
  headline:
    fontFamily: "-apple-system,BlinkMacSystemFont,'HarmonyOS Sans SC','PingFang SC','Microsoft YaHei',sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "-.025em"
  dashboard-headline:
    fontFamily: "-apple-system,BlinkMacSystemFont,'HarmonyOS Sans SC','PingFang SC','Microsoft YaHei',sans-serif"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "-.025em"
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
    lineHeight: 1.6
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
  next-title:
    fontFamily: "-apple-system,BlinkMacSystemFont,'HarmonyOS Sans SC','PingFang SC','Microsoft YaHei',sans-serif"
    fontSize: "24px"
    fontWeight: 650
    lineHeight: 1.45
  next-title-mobile:
    fontFamily: "-apple-system,BlinkMacSystemFont,'HarmonyOS Sans SC','PingFang SC','Microsoft YaHei',sans-serif"
    fontSize: "22px"
    fontWeight: 650
    lineHeight: 1.45
  course-title:
    fontFamily: "-apple-system,BlinkMacSystemFont,'HarmonyOS Sans SC','PingFang SC','Microsoft YaHei',sans-serif"
    fontSize: "17px"
    fontWeight: 650
    lineHeight: 1.5
  course-title-mobile:
    fontFamily: "-apple-system,BlinkMacSystemFont,'HarmonyOS Sans SC','PingFang SC','Microsoft YaHei',sans-serif"
    fontSize: "16px"
    fontWeight: 650
    lineHeight: 1.5
  wake-time:
    fontFamily: "-apple-system,BlinkMacSystemFont,'HarmonyOS Sans SC','PingFang SC','Microsoft YaHei',sans-serif"
    fontSize: "44px"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "-.035em"
  wake-time-mobile:
    fontFamily: "-apple-system,BlinkMacSystemFont,'HarmonyOS Sans SC','PingFang SC','Microsoft YaHei',sans-serif"
    fontSize: "36px"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "-.035em"
  lead-number:
    fontFamily: "-apple-system,BlinkMacSystemFont,'HarmonyOS Sans SC','PingFang SC','Microsoft YaHei',sans-serif"
    fontSize: "48px"
    fontWeight: 650
    lineHeight: 1.3
    letterSpacing: "-.03em"
  navigation:
    fontFamily: "-apple-system,BlinkMacSystemFont,'HarmonyOS Sans SC','PingFang SC','Microsoft YaHei',sans-serif"
    fontSize: "15px"
    fontWeight: 400
  navigation-mobile:
    fontFamily: "-apple-system,BlinkMacSystemFont,'HarmonyOS Sans SC','PingFang SC','Microsoft YaHei',sans-serif"
    fontSize: "12px"
    fontWeight: 400
rounded:
  field: "10px"
  button: "12px"
  date: "13px"
  row: "14px"
  panel: "16px"
  panel-mobile: "15px"
  dialog: "16px"
  progress: "2px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  row-gap: "14px"
  lg: "16px"
  gutter-mobile: "18px"
  panel-mobile: "20px"
  panel: "24px"
  workspace-gap: "26px"
  gutter-tablet: "24px"
  gutter-desktop: "36px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.next-ink}"
    typography: "{typography.button}"
    rounded: "{rounded.button}"
    padding: "0 19px"
    height: "46px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-primary-dark:
    backgroundColor: "{colors.primary-fill-dark}"
    textColor: "{colors.next-ink}"
  button-primary-hover-dark:
    backgroundColor: "{colors.primary-hover-dark}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.button}"
    padding: "0 19px"
  button-secondary-hover:
    backgroundColor: "{colors.soft}"
  button-text:
    textColor: "{colors.primary}"
    padding: "0 6px"
    height: "44px"
  input-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.field}"
    rounded: "{rounded.field}"
    padding: "11px 12px"
  navigation:
    textColor: "{colors.muted}"
    typography: "{typography.navigation}"
    rounded: "{rounded.button}"
    padding: "0 16px"
    height: "52px"
  navigation-active:
    backgroundColor: "{colors.soft}"
    textColor: "{colors.primary}"
  date-chip:
    textColor: "{colors.muted}"
    rounded: "{rounded.date}"
    height: "70px"
  date-chip-selected:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.next-ink}"
  segmented:
    backgroundColor: "{colors.soft}"
    rounded: "{rounded.button}"
    padding: "4px"
  segmented-active:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    padding: "0 18px"
    height: "40px"
  settings-tabs:
    backgroundColor: "{colors.soft}"
    rounded: "{rounded.row}"
    padding: "5px"
  settings-tab:
    textColor: "{colors.muted}"
    rounded: "{rounded.field}"
    height: "48px"
  settings-tab-selected:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
  next-lesson:
    backgroundColor: "{colors.next-bg}"
    textColor: "{colors.next-ink}"
    rounded: "{rounded.panel}"
    padding: "22px 24px"
  wake-card:
    backgroundColor: "{colors.wake-bg}"
    textColor: "{colors.wake-ink}"
    rounded: "{rounded.panel}"
    padding: "22px 24px"
  course-row:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.row}"
    padding: "19px 20px"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "24px"
  course-dialog:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.dialog}"
    padding: "0"
    width: "min(640px,calc(100vw - 32px))"
---

# Design System: 晨课 · 个人课表

## Overview

**Creative North Star: "蓝白馆藏索引"**

把馆藏索引的分组、日期和整齐行列转译成日常课务界面：钴蓝标记可操作与选中状态，深墨色保证中文阅读，浅蓝灰画布承托清楚的白色内容区。下一节课程使用深蓝强调面，起床计划使用克制的浅黄功能面，二者通过色调和字号分出层级。

系统无衬线和等宽数字贯穿课程、日期、时刻与表单。界面保持适当密度，用对齐、间距和少量边界建立秩序；图形来自代码、原生控件和线性 SVG，不添加模拟纸纹、装饰编号或栅格图片。明暗主题沿用同一信息关系。

**Key Characteristics:**

- 钴蓝交互、深蓝课程重点、浅黄起床功能区。
- 中文系统无衬线与等宽数字；课程文字和状态独立于颜色存在。
- 整齐的日期条、对齐的时间列、直接可点的课程行。
- 桌面侧栏与手机底栏分别布局；狭窄空间允许换行与日期横向浏览。
- 平面色调分层为主，只为选项层级和模态浮层保留阴影。

本文记录共享网页视觉，依据 public/style.css 末尾的 Daily workspace 与 Shared task screens 覆盖层、src/main.mjs、src/home-ui.mjs、src/schedule-ui.mjs 和 index.html。具体页面目标保留在 .impeccable/surfaces/src-main-mjs.md。本文件替换旧松绿版本；frontmatter 是规范性令牌，.impeccable/design.json 记录扩展和独立组件示例。

## Colors

以偏冷的蓝白中性色建立阅读秩序，用深蓝和浅黄区分功能。颜色值由 frontmatter 统一维护；代码中的历史变量 --green 现在承载钴蓝，不能按变量名恢复绿色外观。

### Primary

- **钴蓝交互**（primary）：主要按钮、品牌标记、日期选择、当前时间与焦点；悬停使用对应 hover 令牌。
- **夜间浅蓝交互**（primary-dark）：深色模式的链接、定位与交互文字。实色按钮和选中日期使用 primary-fill-dark，保持白字可读。
- **课程深蓝**（next-bg / next-ink / next-muted）：课程重点色面、主文字与次级元信息，明暗主题配对切换。

### Secondary

- **起床浅黄**（wake-bg / wake-ink）：起床时刻、首课依据和状态；夜间仍保留浅黄功能区与深色文字。
- **课程分组色**（mint / sky / lavender / peach / rose）：周课表与颜色选择器的五组色面，搭配各自 -ink。名称沿用数据模型，mint 当前实际为浅蓝；夜间配对切换 -dark。
- **错误莓红**（danger）：错误文字，夜间使用对应令牌；错误状态面与旧闹钟提醒面的前景/背景配对记录在侧车扩展。

### Neutral

- **浅蓝灰画布**（canvas）与 **内容白**（surface）：页面基底、日程行、表单和普通内容区。
- **深墨阅读**（ink）与 **蓝灰说明**（muted）：正文和辅助信息。
- **轻边界**（line）与 **柔蓝底**（soft）：分隔、控件组、当前日、悬停、选中导航与状态说明。
- 中性色均有深色配对，不只翻转页面背景。

**The Functional Color Rule.** 钴蓝用于操作和定位，浅黄用于起床功能区；课程分组色不承诺调度成功，状态必须写出文字。

侧车的八步 OKLCH 色阶是生成的设计面板预览元数据，未加入应用 CSS，不作为新增界面颜色。

## Typography

**Display Font:** 系统中文无衬线，复用 frontmatter 的系统字体栈。
**Body Font:** 与标题相同。
**Label/Mono Font:** 无独立等宽字体；数字通过 font-variant-numeric: tabular-nums 对齐。

**Character:** 中文清楚、数字稳定，用尺寸和字重区分课程、时刻与状态，不使用装饰标题字体。

### Hierarchy

- **Headline**（headline / dashboard-headline）：普通页标题与桌面今日标题；触控首页使用普通标题尺寸。
- **Title**（title）：区块标题。课程重点使用 next-title，手机使用 next-title-mobile。
- **Body**（body）：默认阅读文字；输入控件使用 field，避免输入文字过小。
- **Label**（label）：短标签与表单基础标签；表单长说明按现有组件提高至正文附近。
- **Course Title**（course-title / course-title-mobile）：桌面与触控日程课程名。
- **Time**（wake-time / wake-time-mobile）：起床时刻。提前量使用 lead-number；闹钟页的明日时刻独立置于浅黄区，不与提前量混排。
- **Navigation**（navigation / navigation-mobile）：桌面侧栏与手机底栏。

**The Readable Time Rule.** 时间保持等宽数字，课程名和地点允许换行；不要为整齐外观截断关键安排。

## Layout

桌面容器最大宽度（1360px），左右内边距（36px）。宽度达到（1024px）时主内容左侧让出（204px），侧栏宽（174px），顶栏高（84px）。今日工作区为弹性主列和（280px）次列，间距（26px）；（1024–1150px）次列收至（230px），间距（20px）。

（1023px）及以下使用四项底部导航，底栏至少（70px），内容保留底部空间。平板边距（24px）；触控布局适用于不超过（760px）、低矮横屏或无悬停粗指针，边距（18px），顶栏高（68px），内容纵向排列。扩展页面继承这些自适应条件。

日期数据始终保留七天：桌面完整排列；触控布局一次显示五个日期并可横向滑动；小于（359px）一次显示三个并保留滑动提示。选择态与日程内容保持对应。周课表允许横向浏览，不挤成不可读的小字。

课程行使用固定时间列、弹性信息列和状态列：桌面时间列（64px），手机（55px）。课程名和地点可换行，多数操作目标（44px）或更高。校对列表在触控布局中把操作移到独立一行，避免压缩课程文字。

设置工作区最大宽度（980px），分类条始终保留五列；桌面图标与文字横排，触控布局改为纵排。单个设置内容区桌面内边距（28px），触控为（22px 20px）；学期表单最大宽度（620px）。课程编辑浮层使用 course-dialog 宽度，触控时左右各留（8px）；跟随 visual viewport 调整可用高度，键盘打开时隐藏底栏，保留表单滚动与保存入口。

## Elevation & Depth

主要层级来自冷色画布、白色内容面和深浅功能面。普通按钮、课程行、侧栏和底栏无投影，以间距、边界和背景变化表达关系。课程编辑器为模态浮层，通过遮罩和阴影区分底层。

### Shadow Vocabulary

- **选中分段**（0 2px 5px #1b24380a）：只为分段控件的当前选项提供轻层级。
- **课程编辑浮层**（0 18px 70px #15244930）：课程弹窗；浅色遮罩（#13213c66），深色遮罩（#080c17aa）。

**The Flat Surface Rule.** 普通内容区和课程行使用色面、间距与细边界建立层级；阴影只保留已实现的选中分段和模态浮层用途。

## Shapes

圆角适度、边缘干净：字段、按钮、日期、日程行、功能面、弹窗使用各自令牌。主面板使用 panel，触控功能面使用 panel-mobile；手机课程行实际（13px）、日期实际（12px），周课表课程块（9px）。圆点用于有课标记、课程分组和时间定位。

描边通常（1px），使用轻边界；进行中日程行使用钴蓝外框。可见键盘焦点为（3px）描边、偏移（3px），不依赖悬停才出现。

## Components

### Buttons

主要按钮蓝底白字；次要按钮为内容面、正文色和轻边界；文字按钮使用交互蓝。普通高度至少（46px），紧凑按钮至少（44px）。主按钮悬停使用 hover 色，次要及文字按钮使用柔蓝底；禁用降低不透明度并保留原生语义。

日期、主按钮和导航状态过渡（160ms ease-out）；减少动效偏好关闭相关过渡。动效不表示闹钟调度成功。

### Chips

日期片由星期、日期、有课圆点组成。选中蓝底白字；今天但未选中使用柔蓝底。日期片保留 aria-label、aria-pressed 与可见焦点。

### Cards / Containers

内容面使用 surface，主面板使用 panel 内边距，手机通常使用 panel-mobile 内边距。日程行保持中性内容面；进行中增加蓝色外框和进度细线，已结束降低不透明度，所有状态保留文字。

### Inputs / Fields

内容面、正文色、轻边界和字段圆角。输入使用 field，最小高度（44px），常规内边距（11px 12px），勾选、滑杆和插入点使用交互色。错误显示在相关区域，使用可读文字。提前量精确输入保持固定数值列，与标签和单位分开，避免被挤成窄框。

学期、例外日期和编辑器基本信息字段提高至（48px）；上课时间与周次字段至少（46px）。显式标签位于字段上方，长说明单独换行。

### Navigation

课表、导入、闹钟、设置四项导航。桌面侧栏图标文本横排，手机底栏纵排；选中蓝字与柔蓝底并用，桌面浅色选中底实际（#e3eaff）。保留 aria-current="page" 和每项文字。导入入口仅保留在主导航中，共享顶栏不再重复显示。

### Segmented Control

日程与周课表使用柔蓝底双项分段。选中为内容面、深墨字和轻投影。两项直接可点，日期选择不替代视图切换。

### Settings Category Tabs

学期、节次、课程、调课、备份使用五项等宽分类条。柔蓝底承托内容面选中项，选中同时使用钴蓝文字和较高字重，不加阴影。桌面项高度使用 settings-tab，触控项至少（58px）。

分类条保留 tablist、tab、tabpanel、aria-selected 与关联标签，只有当前项进入 Tab 顺序；方向键及 Home / End 切换并聚焦。切换仅隐藏内容区，保留未保存输入。侧车以此替换双项分段示例，控制示例总量，不移除应用中的视图分段。

### Import Review

导入使用三步过程提示、文件选择和可直接粘贴的文字区。校对项保留编号、弹性课程信息和独立操作组；触控时校对与移除在底部成行，以细边界分隔。课程名、地点、周次与识别说明允许换行，提交区同时保留“待确认、不直接设置闹钟”的说明。

### Alarm Preferences

开关和完整标签同行，文字列可收缩换行，开关不被挤压；标签同时包含规则说明，保留原生 checkbox 与 switch 语义。明日时刻使用独立浅黄区域，系统发送、授权与错误信息另列；状态标题和原因始终来自实际平台结果。

### Grouped Course Editor

课程编辑浮层统一为内容面与 dialog 圆角。基本信息、上课时间和周次分组，组间使用轻边界；时间填写方式、单双周、具体周次与单次日期保留独立入口。标题栏和保存栏在浮层内粘附，正文可滚动；触控布局将基本字段改为单列，同时保留开始与结束时间的成对关系。

### Backup Action Rows

导出备份、恢复备份和导出日历使用完整宽度的图标文字行，以细分隔线区分；主标题和说明分层，末端箭头提示入口。行高桌面至少（88px），触控至少（94px）；恢复行由原生文件输入覆盖完整点击区，聚焦时整行显示焦点。清空操作单独放在下方危险区域，并保留外部时钟需单独处理的说明。

### Next Lesson

深蓝重点面，先显示当前/下一节状态及时间间隔，再给课程名、时刻与地点；课程可进入编辑，长文字换行。已无后续课程时切成柔蓝普通面；当天无课时不虚构课程。

### Tomorrow Wake

浅黄功能区，以大时刻配合首课、提前量和真实状态。桌面纵排，手机时间在右。休息、待确认、暂停、网页预览、未授权、请求发送等状态都通过文字表达；黄色面和大时刻不代表系统已保存。

## Do's and Don'ts

### Do:

- Do 保持钴蓝选择态、深蓝课程重点和浅黄起床区的功能关系。
- Do 在课程、日期和状态旁保留可读文字、可见焦点与明确的按钮名称。
- Do 用已实现的间距、圆角和系统字体扩展新页面，并为长课程名与地点留出换行空间。
- Do 让深色主题切换完整的前景与背景配对，遵守减少动效偏好。
- Do 依据实际平台结果显示状态；网页示例使用明确的预览说明。

### Don't:

- Don't 恢复已被替换的松绿视觉、模拟纸纹或装饰编号。
- Don't 把课程分组色变成整张日程行的底色；当前日程行使用中性内容面。
- Don't 用大面积阴影、渐变或额外插图填充课务信息区域。
- Don't 把桌面主内容直接拉宽为手机版；保留不同导航与内容排列。
- Don't 把“已发送免确认请求”改写成“闹钟已设置成功”，也不把浏览器截图当作真机响铃证明。
