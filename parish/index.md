---
layout: post
title: 'Parish Minutes'
description: 'Historic minutes of the Longwick-cum-Ilmer Parish Meeting and Longwick-cum-Ilmer Parish Council.'
category: history
tags: [post]
breadcrumb: false
image: images/parishcouncil.avif
---

<ul>
{%- for item in collections.parish-minutes -%}
    <li><a href="{{ item.url }}">{{ item.data.title }}</a></li>
{%- endfor -%}
</ul>
