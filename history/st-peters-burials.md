---
layout: post
title: Burials
description: "Full transcript of burials recorded at St Peter's Ilmer, 1602-1981."
category: history
tags: [history]
image: images/IlmerChurch-RoyManser-1984.avif
ancestorCrumb2Source: { label: 'Parish Records', url: '/history/parish-records/' }
ancestorCrumb1Source: { label: "St Peter's Church", url: '/history/st-peters/' }
ageFields:
  - { key: age, label: 'Median Age At Death' }
---

{% render "register-summary.liquid", records: st-peters-burials, yearKey: "year", label: "burials", ageFields: ageFields %}

{% render "year-bar-chart.liquid", records: st-peters-burials, yearKey: "year", label: "burials", href: "#register" %}

Burials transcribed from the [registers and records of St Peter's Ilmer](/history/parish-records/). Entries before 1687 are taken from Bishops Transcripts rather than the surviving parish registers. Age at death was only recorded by the register from the early 19th century, so that column is blank for earlier entries. The Notes column preserves the register's own wording, such as a relationship ("wife of Thomas") or address.

The median uses only recorded ages, including infant ages converted to fractions of a year; blank entries and "no age" are excluded. It describes these recorded burials, not life expectancy.

<table id="register" class="census-table">
  <thead class="table-header--sticky">
    <tr>
      <th>Year</th>
      <th>Date</th>
      <th>Forename</th>
      <th>Surname</th>
      <th>Age</th>
      <th>Notes</th>
    </tr>
  </thead>
  <tbody>
    {%- for item in st-peters-burials -%}
      <tr>
        <td data-type="number">{{ item.year }}</td>
        <td>{{ item.date }}</td>
        <td>{{ item.forename }}</td>
        <td>{{ item.surname }}</td>
        <td>{{ item.age }}</td>
        <td>{{ item.notes }}</td>
      </tr>
    {%- endfor -%}
  </tbody>
</table>
