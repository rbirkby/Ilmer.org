---
layout: post
title: Marriages
description: "Full transcript of marriages recorded at St Peter's Ilmer, 1600-1969."
category: history
tags: [history]
image: images/IlmerChurch-RoyManser-1984.avif
ancestorCrumb2Source: { label: 'Parish Records', url: '/history/parish-records/' }
ancestorCrumb1Source: { label: "St Peter's Church", url: '/history/st-peters/' }
---

{% render "register-summary.liquid", records: st-peters-marriages, yearKey: "year", label: "marriages" %}

Marriages transcribed from the [registers and records of St Peter's Ilmer](/history/parish-records/). Entries before 1679 are taken from Bishops Transcripts rather than the surviving parish registers. Age, marital condition and occupation were only recorded by the register from 1822, so those columns are blank for earlier entries. The Type column records whether a marriage was authorised by Banns or by Licence, where the register from 1708-1837 states it.

<table class="census-table">
  <thead class="table-header--sticky">
    <tr>
      <th rowspan="2">Year</th>
      <th rowspan="2">Date</th>
      <th rowspan="2">Type</th>
      <th colspan="5">Groom</th>
      <th colspan="5">Bride</th>
      <th rowspan="2">Notes</th>
    </tr>
    <tr>
      <th>Name</th>
      <th>Age</th>
      <th>Condition</th>
      <th>Occupation</th>
      <th>Residence</th>
      <th>Name</th>
      <th>Age</th>
      <th>Condition</th>
      <th>Occupation</th>
      <th>Residence</th>
    </tr>
  </thead>
  <tbody>
    {%- for item in st-peters-marriages -%}
      <tr>
        <td data-type="number">{{ item.year }}</td>
        <td>{{ item.date }}</td>
        <td>{{ item.type }}</td>
        <td>{{ item.groom_forename }} {{ item.groom_surname }}</td>
        <td>{{ item.groom_age }}</td>
        <td>{{ item.groom_condition }}</td>
        <td>{{ item.groom_occupation }}</td>
        <td>{{ item.groom_residence }}</td>
        <td>{{ item.bride_forename }} {{ item.bride_surname }}</td>
        <td>{{ item.bride_age }}</td>
        <td>{{ item.bride_condition }}</td>
        <td>{{ item.bride_occupation }}</td>
        <td>{{ item.bride_residence }}</td>
        <td>{{ item.notes }}</td>
      </tr>
    {%- endfor -%}
  </tbody>
</table>
