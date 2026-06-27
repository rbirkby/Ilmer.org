---
layout: post
title: 'Courts and Crime'
description: 'Courts, crime and misdemeanours.'
category: history
tags: [post]
image: images/quarter-sessions.avif
---

<ul>
{%- for item in collections.courts-and-crimes -%}
    <li><a href="{{ item.url }}">{{ item.data.title }}</a></li>
{%- endfor -%}
</ul>
