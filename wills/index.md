---
layout: post
title: 'Wills'
description: 'Historic wills and codicils connected to Ilmer.'
permalink: /wills/
tags: ['post']
image: images/wills.avif
---

## Transcriptions

<ul>
{% for item in collections.all %}
  {% if item.data.category == 'wills' %}
    <li><a href="{{ item.url }}">{{ item.data.title }}</a></li>
  {% endif %}
{% endfor %}
</ul>

## Wills data

The following wills, available in the Bucks Archives, relate to the village of Ilmer.

{% assign sortedWills = wills | sort: 'YearProved' %}

<table>
  <thead>
    <tr>
      <th>Name</th>
      <th>Occupation</th>
      <th>Will date</th>
      <th>Proved</th>
      <th>Archive refs</th>
    </tr>
  </thead>
  <tbody>
    {% for will in sortedWills %}

{% capture will_date %}{{will.YearWill}}-{{will.MonthWill}}-{{will.DaysWill}}{% endcapture %}
{% capture proved_date %}{{will.YearProved}}-{{will.MonthProved}}-{{will.DaysProved}}{% endcapture %}

<tr>
  <td>
    {% if will.Transcription %}
      <a href="{{will.Transcription}}" title="View Transcription">{{ will.FirstName }} {{ will.LastName }}</a>
    {% else %}
      {{ will.FirstName }} {{ will.LastName }}
    {% endif %}
  </td>
  <td>{{ will.Occupation }}</td>
  <td>{{ will_date | date: "%d %b %Y" | replace: "-", "" }}</td>
  <td>{{ proved_date | date: "%d %b %Y" | replace: "-", "" }}</td>
  <td>
    {% if will.DAWe %} DA/WE/{{ will.DAWe | replace: " ", "/" | replace: "//", "/" }} {% endif %}<br>
    {% if will.DAWf %} DA/WF/{{ will.DAWf | replace: " ", "/" | replace: "//", "/" }} {% endif %}
  </td>
</tr>
{% endfor %}

  </tbody>
</table>
