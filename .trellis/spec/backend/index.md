# Backend Development Guidelines

> Best practices for backend development in this project.

---

## Overview

This directory contains guidelines for backend development. Fill in each file with your project's specific conventions.

---

## Guidelines Index

| Guide                                           | Description                         | Status  |
| ----------------------------------------------- | ----------------------------------- | ------- |
| [Directory Structure](./directory-structure.md) | Module organization and file layout | To fill |
| [Database Guidelines](./database-guidelines.md) | D1 patterns, queries, migrations    | Filled  |
| [Public Data Cache](./public-data-cache.md) | Cache API public DTO contracts and rollout gates | Filled |
| [管理员批量导入活动](./admin-bulk-event-import.md) | CSV 预览、API、D1 原子写入 | 已填写 |
| [会员购活动导入](./admin-bilibili-ticket-import.md) | 固定上游预填、重复确认、D1 原子写入 | 已填写 |
| [Error Handling](./error-handling.md)           | Error types, handling strategies    | Filled  |
| [Quality Guidelines](./quality-guidelines.md)   | Code standards, forbidden patterns  | To fill |
| [Logging Guidelines](./logging-guidelines.md)   | Structured logging, log levels      | To fill |

---

## How to Fill These Guidelines

For each guideline file:

1. Document your project's **actual conventions** (not ideals)
2. Include **code examples** from your codebase
3. List **forbidden patterns** and why
4. Add **common mistakes** your team has made

The goal is to help AI assistants and new team members understand how YOUR project works.

---

**文档语言**：所有项目文档应使用**简体中文**。代码标识符、API 路径、命令、配置键和必要的技术术语保持原文。

**符号规范**: 禁止使用全角标点或其他全角符号; 统一使用对应的半角 ASCII 符号.
