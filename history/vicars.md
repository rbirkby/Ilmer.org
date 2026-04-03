---
layout: post
title: Vicars
description: "Vicars of St Peter's Ilmer"
category: history
tags: [vicar, history, post]
image: images/church-drawing-unknown-1978.jpg
---

{% assign filteredEvents = historicalEvents | where_exp: "event", "event.labels contains 'vicar'" %}
{% assign allReferences = '' | split: '' %}

{%- for event in filteredEvents -%}
{%- if event.references -%}
{%- assign allReferences = allReferences | concat: event.references -%}
{%- endif -%}
{%- endfor -%}

{% assign uniqueReferences = allReferences | uniq %}

<table>
  <thead>
    <tr>
      <th>Date</th>
      <th>Title</th>
      <th>Description</th>
    </tr>
  </thead>
  <tbody>
    {%- for event in filteredEvents -%}
      {% assign referenceLinks = '' %}

      {%- if event.references -%}
        {%- capture referenceLinks -%}
          {%- for eventReference in event.references -%}
            {%- for uniqueReference in uniqueReferences -%}
              {%- if eventReference == uniqueReference -%}
                <a href="#reference-{{ forloop.index }}">[{{ forloop.index }}]</a>
              {%- endif -%}
            {%- endfor -%}
          {%- endfor -%}
        {%- endcapture -%}
      {%- endif -%}

      <tr>
        <td>{{ event.date }}</td>
        <td>{{ event.title }}</td>
        <td>{{ event.description | renderMarkdownInline }}
          {% if referenceLinks != blank %}<sup class="footnote-ref">{{ referenceLinks | strip_newlines | strip }}</sup>{% endif %}
        </td>
      </tr>
    {%- endfor -%}

  </tbody>
</table>

{% if uniqueReferences.size > 0 %}

  <section class="footnotes">
    <ol class="footnotes-list">
      {%- for reference in uniqueReferences -%}
        <li class="footnote-item" id="reference-{{ forloop.index }}">
          {{ reference | renderMarkdownInline }}
        </li>
      {%- endfor -%}
    </ol>
  </section>
{% endif %}

<small>\* _Drawing of Ilmer Church, taken from 1978 Flower Festival scrapbook. Artist unknown._</small>
