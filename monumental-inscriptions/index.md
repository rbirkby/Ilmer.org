---
layout: post
title: 'Monumental Inscriptions'
description: 'Monumental Inscriptions of St Peters, Ilmer'
category: history
tags: [church, history]
image: images/church-watercolour.jpg
ancestorCrumb1Source: { label: St Peter's Church, url: '/history/st-peters/' }
permalink: /history/monumental-inscriptions/
lightbox: true
---

The original survey of the churchyard was undertaken by Rex Kidd in 1985 and updated and retyped by Jenny Peel in 2007; copies were given to St Peter's Ilmer, the Bucks Family History Society and Princes Risborough Heritage Society. It records every memorial in the church and churchyard: Section A is inside the church, Section B is to the north side, and Section C, the larger of the two churchyard sections, is to the south side. [The digitised copy](/assets/pdfs/ilmer-church-monumental-inscriptions.pdf) is the source for the transcriptions below.

{% assign sectionA = collections.monumentalInscription | where: "data.section", "A" | sortByMemorialId %}
{% assign sectionB = collections.monumentalInscription | where: "data.section", "B" | sortByMemorialId %}
{% assign sectionC = collections.monumentalInscription | where: "data.section", "C" | sortByMemorialId %}
{% assign plottedMemorials = collections.monumentalInscription | where: "data.col" %}

## Churchyard plan

Each numbered plot below links to its transcription further down the page. Section A, inside the church, has no plotted position on the original sketch.

{% render "churchyard-plan-svg.liquid", plan: st-peters-churchyard-plan, plots: plottedMemorials %}

## Section A: memorials inside the church

{% for memorial in sectionA %}{% render "memorial.liquid", memorial: memorial %}{% endfor %}

## Section B: north side of the church

{% for memorial in sectionB %}{% render "memorial.liquid", memorial: memorial %}{% endfor %}

## Section C: south side of the church

{% for memorial in sectionC %}{% render "memorial.liquid", memorial: memorial %}{% endfor %}

## Surname index

The survey's own alphabetical index, giving the memorial reference(s) for each named person. Entries marked "see" are indexed under a different surname, typically by marriage.

<ul class="memorial-index">
  {%- for entry in st-peters-monumental-inscriptions-index -%}
    <li class="memorial-index__entry">
      <span class="memorial-index__name"><strong>{{ entry.surname }}</strong> {{ entry.forename }}</span>
      {%- if entry.seeAlso -%}
        <span class="memorial-index__refs">see {{ entry.seeAlso }}</span>
      {%- else -%}
        <span class="memorial-index__refs">
          {%- for loc in entry.locations -%}
            {%- if loc == "PREFACE" -%}
              Preface{%- unless forloop.last -%}, {% endunless -%}
            {%- elsif loc == "RollOfHonour" -%}
              <a href="#RollOfHonour">Roll of Honour</a>{%- unless forloop.last -%}, {% endunless -%}
            {%- else -%}
              <a href="#{{ loc }}">{{ loc }}</a>{%- unless forloop.last -%}, {% endunless -%}
            {%- endif -%}
          {%- endfor -%}
        </span>
      {%- endif -%}
    </li>
  {%- endfor -%}
</ul>
