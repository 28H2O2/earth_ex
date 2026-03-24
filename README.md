# WorldEx

用 6 种颜色记录你对世界各国家/地区的旅行状态。

## Inspiration

本项目的交互灵感来自 [`ukyouz/JapanEx`](https://github.com/ukyouz/JapanEx)。

- 原项目：JapanEx / 日本制县
- 本仓库中的参考副本位于 `.reference/JapanEx/`
- 本项目并非该项目的官方分支，而是基于其“点击地图记录旅行等级”的核心想法，面向世界地图场景重新实现
- 当前实现针对世界地图做了独立的数据结构、状态序列化、导出图片和 UI 设计调整

## Features

- 国家/地区级世界地图，支持点击设置 6 个等级
- 6 级旅行状态：
  - `0` Never been there
  - `1` Passed there
  - `2` Alighted there
  - `3` Visited there
  - `4` Stayed there
  - `5` Lived there
- 自动本地保存
- URL 分享状态恢复
- 国家搜索与地图定位
- 两种完整图片导出：
  - 海报图：完整世界地图 + 名字 + 图例 + 统计
  - 纯地图图：完整世界地图

## Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- `world-atlas` + `topojson-client` + `d3-geo`
- `html-to-image`

## Development

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`。

## Production

```bash
npm run build
npm run start
```

`build` 脚本目前使用 `webpack`，避免 Next 16 默认 Turbopack 在部分受限环境下的构建兼容问题。

## Data / Scope

- 首版范围是国家/地区级 MVP
- 地图边界跟随标准公开数据源
- 当前不包含账号系统或后端同步
- 图片导出始终生成完整世界图，不受当前页面缩放影响

## Structure

- `src/components`
  - 地图 UI、交互逻辑、导出模板
- `src/data`
  - 旅行等级定义
- `src/lib`
  - 地图数据转换、状态序列化、统计逻辑
- `src/types`
  - 共享类型定义

## Reference

- Inspiration source: [`ukyouz/JapanEx`](https://github.com/ukyouz/JapanEx)
- 本仓库中的参考代码位于 `.reference/JapanEx/`
- 参考目录仅用于灵感和交互思路对照，不参与当前应用构建或 lint
