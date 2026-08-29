---
layout: post
title: 'Censuses'
subtitle: 'Censuses from X to X'
description: 'Historic censuses of Ilmer.'
category: history
tags: [post]
image: images/census.avif
useArchiveCss: true
headerUseCensus: true
---

{%- assign chart = collections.census | censusChart -%}

<div class="census-header">
  <div class="census-header__intro">
    <h1 class="minute-heading">Censuses</h1>
    {% include "archive-flourish.liquid" %}
    <p>Discover Ilmer through the people who lived here. Explore census returns from {{ chart.firstYear }} to {{ chart.lastYear }}.</p>
  </div>
  <div class="census-header__chart">
    <p class="census-header__chart-range">{{ chart.firstYear }}&ndash;{{ chart.lastYear }} &middot; <em>{{ chart.count }} returns</em></p>
    <hr class="census-header__chart-rule">
    <p class="census-header__chart-label">Residents recorded</p>
    <svg
      class="census-header__chart-svg"
      viewBox="0 0 {{ chart.width }} {{ chart.height }}"
      role="img"
      aria-label="Residents recorded at each census, {{ chart.firstYear }} to {{ chart.lastYear }}">
      <polyline points="{{ chart.linePoints }}"></polyline>
      {%- for p in chart.points -%}
        <circle cx="{{ p.x }}" cy="{{ p.y }}" r="2.6"></circle>
        <text class="census-header__chart-value" x="{{ p.x }}" y="{{ p.y | minus: 8 }}">{{ p.population }}</text>
        <line class="census-header__chart-tick" x1="{{ p.x }}" y1="{{ chart.tickTop }}" x2="{{ p.x }}" y2="{{ chart.tickBottom }}"></line>
        <text class="census-header__chart-year" x="{{ p.x }}" y="{{ chart.labelY }}">{{ p.year }}</text>
      {%- endfor -%}
    </svg>
  </div>
</div>

<ul class="census-list">
  {%- for item in collections.census -%}
    <li>
      <span class="census-list__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
          <rect x="3.5" y="5" width="17" height="16" rx="2"></rect>
          <path d="M3.5 9.5h17M8 3v4M16 3v4"></path>
        </svg>
      </span>
      <span class="census-list__date">
        <span class="census-list__year">{{ item.data.date | isoDateYear }}</span>
        <span class="census-list__day">{{ item.data.date | isoDateLabel | upcase }}</span>
      </span>
      <span class="census-list__summary">{{ item.data.description }}</span>
      <span class="census-list__population">{{ item.data.population }} residents</span>
      <a class="census-list__link" href="{{ item.url }}">View census <span aria-hidden="true">&rarr;</span></a>
    </li>
  {%- endfor -%}
</ul>
