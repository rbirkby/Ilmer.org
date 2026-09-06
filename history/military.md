---
layout: post
title: 'Military'
description: 'Conflicts, war-dead, and muster lists.'
category: history
tags: [post]
image: images/IlmerWarPlaque.avif
---

<ul>
{%- for item in collections.military -%}
    <li><a href="{{ item.url }}">{{ item.data.title }}</a></li>
{%- endfor -%}
</ul>
