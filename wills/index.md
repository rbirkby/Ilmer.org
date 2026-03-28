---
layout: post
title: 'Wills'
description: 'Historic wills and codicils connected to Ilmer.'
permalink: /wills/
tags: ['post']
image: images/wills.avif
---

{% for item in collections.all %}
{% if item.data.category == "wills" %}

- [{{ item.data.title }}]({{ item.url }})
  {% endif %}
  {% endfor %}
