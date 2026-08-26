---
layout: post
title: St Peter's Church
description: '12th century church in Ilmer, Buckinghamshire, England.'
category: history
tags: [post]
image: images/church-linedrawing-postcard.avif
useArchiveCss: true
---

<ul>
{%- for item in collections.church -%}
    <li><a href="{{ item.url }}">{{ item.data.title }}</a></li>
{%- endfor -%}
</ul>
