---
layout: post
title: Baptisms
description: "Full transcript of baptisms recorded at St Peter's Ilmer, 1575-1982."
category: history
tags: [history]
image: images/IlmerChurch-RoyManser-1984.avif
ancestorCrumb1Source: { label: 'Parish Records', url: '/history/parish-records/' }
---

{% render "register-summary.liquid", records: st-peters-baptisms, yearKey: "baptism_date", label: "baptisms" %}

Baptisms transcribed from the [registers and records of St Peter's Ilmer](/history/parish-records/). Entries before 1660 are taken from Bishops Transcripts rather than the surviving parish registers. Where a father's occupation or a birth date was recorded (from 1813 and 1910 respectively) it is shown alongside the entry; blank cells mean the register did not record that detail.

<table class="census-table">
  <thead class="table-header--sticky">
    <tr>
      <th>Baptised</th>
      <th>Born</th>
      <th>Child</th>
      <th>Father</th>
      <th>Occupation</th>
      <th>Mother</th>
      <th>Notes</th>
    </tr>
  </thead>
  <tbody>
    {%- for item in st-peters-baptisms -%}
      <tr>
        <td>{{ item.baptism_date }}</td>
        <td>{{ item.birth_date }}</td>
        <td>{{ item.child_forename }} {{ item.child_surname }}</td>
        <td>{{ item.father_forename }}</td>
        <td>{{ item.father_occupation }}</td>
        <td>{{ item.mother_forename }}</td>
        <td>{{ item.notes }}</td>
      </tr>
    {%- endfor -%}
  </tbody>
</table>
