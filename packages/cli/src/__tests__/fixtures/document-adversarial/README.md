---
title: DialectOS Launch Test
slug: dialectos-launch
---

# DialectOS Launch Guide

Hi {userName}, your %{count} files are ready at https://example.com/app.

## Transit Copy

Catch the bus to the office. Ride the bus to support. Get on the bus near reception.

## Account Security

Please update your password before continuing. You can update your account now.

## Regional Food

Buy avocado for lunch. Buy hot sauce for lunch. Use yam in the recipe.

## Technical Pickup

Pick up the file before deployment. Pick up the package from reception.

## Negative Control

Do not use slang in this customer support message.

| Source | Expected behavior |
| --- | --- |
| `{userName}` | Keep placeholder |
| `%{count}` | Keep ICU count |
| `https://example.com/app` | Keep URL |

```ts
const url = "https://example.com/app";
console.log({ userName: "Ada" });
```

[Open the app](https://example.com/app) and contact support if the payment fails.
