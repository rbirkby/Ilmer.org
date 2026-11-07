---
layout: post
title: 'Taxation'
description: 'Taxation and surveys.'
tags: [post]
image: images/taxation.avif
---

<ul>
{%- for item in collections.taxation -%}
    <li><a href="{{ item.url }}">{{ item.data.title }}</a></li>
{%- endfor -%}
</ul>
