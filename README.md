# Gemini UI Tuner

[简体中文](README.md) | [English](README-en.md)

一个美化Gemini UI扩展，调整模型回答正文、标题、列表、代码块、侧栏、用户消息气泡和顶部遮罩效果。

## 截图
默认样式：
<p align="center">
  <img src="images/image1.png" alt="修改前">
</p>

使用插件后：
<p align="center">
  <img src="images/image2.png" alt="修改后">
  </p>


 点击扩展图标可进入设置：
<p align="center">
  <img src="images/image4.png" alt="设置">
</p>


## 功能特性

- 调整回答正文、标题，优化无序列表。
- 自定义代码块样式。
- 自定义侧栏背景和用户消息气泡背景色样式。

## 使用方式

1. 在 [Releases](https://github.com/hydrofluoric07/Gemini-UI-Tuner/releases/latest) 下载最新压缩包并解压。
2. 打开 Chrome 扩展管理页：`chrome://extensions/`。
3. 开启右上角“开发者模式”。
4. 点击“加载已解压的扩展程序”，加载本插件。
5. 打开或刷新 `https://gemini.google.com/`。

点击浏览器工具栏中的扩展图标，可打开设置页面自定义样式。修改参数后点击“保存设置”。

如果页面没有立即变化，刷新 Gemini 页面或重新加载扩展即可。

## 自定义代码语言包

标准压缩包只内置常用 Shiki 语言文件。若需要 Rust、PHP、Vue、C# 等更多语言，可打开 [自定义语言包下载器](https://hydrofluoric07.github.io/Gemini-UI-Tuner/language-builder/index.html)：

1. 勾选需要支持的代码语言。
2. 点击“生成自定义压缩包”。
3. 解压下载的 `Gemini-UI-Tuner-*-custom-langs.zip`。
4. 在 `chrome://extensions/` 中加载解压后的文件夹。



## License

MIT License
