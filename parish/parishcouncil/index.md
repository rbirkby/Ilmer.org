---
layout: post
title: 'Parish Council Minutes'
description: 'Historic minutes of the Longwick-cum-Ilmer Parish Council.'
category: history
tags: [post]
breadcrumb: false
image: images/parishcouncil.avif
---

{%- assign current_year = "" -%}
{%- for item in collections.minutes -%}
{%- assign year = item.date | date: "%Y" -%}
{%- if year != current_year -%}
{%- unless forloop.first -%}
</ul>
    {%- endunless -%}
<h2>{{ year }}</h2>
<ul>
    {%- assign current_year = year -%}
  {%- endif -%}
    <li><a href="{{ item.url }}">{{ item.data.title | replace_first: "Parish Council Minutes - ", "" }}</a></li>
{%- endfor -%}
</ul>

---
