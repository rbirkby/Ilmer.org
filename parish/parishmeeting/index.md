---
layout: post
title: 'Parish Meeting Minutes'
description: 'Historic minutes of the Longwick-cum-Ilmer Parish Meeting.'
category: history
tags: [parish-minutes]
breadcrumb: 'Parish Minutes'
breadcrumbUrl: '/parish/'
---

{%- assign current_decade = "" -%}
{%- for item in collections.parishmeetings -%}
{%- assign year = item.date | date: "%Y" | plus: 0 -%}
{%- assign decade = year | divided_by: 10 | floor | times: 10 -%}
{%- if decade != current_decade -%}
{%- unless forloop.first -%}
</ul>
    {%- endunless -%}
<h2>{{ decade }}s</h2>
<ul>
    {%- assign current_decade = decade -%}
  {%- endif -%}
    <li><a href="{{ item.url }}">{{ item.data.title | replace_first: "Parish Meeting Minutes - ", "" }}</a></li>
{%- endfor -%}
</ul>
