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
{%- for item in collections.all -%}
  {%- if item.data.category == 'wills' -%}
    <li><a href="{{ item.url }}">{{ item.data.title }}</a></li>
  {%- endif -%}
{%- endfor -%}
</ul>

## Wills data

The following wills proved at the Archdeacon’s Court are available in the [Bucks Archives](https://www.buckinghamshire.gov.uk/culture-and-tourism/archives/archive-services/copies-of-documents/), relate to the village of Ilmer. Other wills proved at the Prerogative Court of Canterbury and now in the National Archives/PRO at Kew are not listed below. None of the wills listed below were proved at the Peculiar Court of Monks Risborough.

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
    {% if will.DAWe %} D/A/We/{{ will.DAWe | replace: " ", "/" | replace: "//", "/" }} {% endif %}<br>
    {% if will.DAWf %} D/A/Wf/{{ will.DAWf | replace: " ", "/" | replace: "//", "/" }} {% endif %}
  </td>
</tr>
{% endfor %}

  </tbody>
</table>

### Key

| Code  | Description                       |
| ----- | --------------------------------- |
| DA/WE | Registered copy of a will         |
| DA/WF | Original and File Copies of Wills |

### Bucks Records Society

#### Buckinghamshire Probate Index

| Date | Name                                                          | Occupation         | Value    | References                   |
| ---- | ------------------------------------------------------------- | ------------------ | -------- | ---------------------------- |
| 1492 | Trippe, William                                               |                    |          | D/A/V/1 fo.5                 |
| 1551 | Goodwyne, John                                                |                    | £41-6-8  | D/A/We/154/73                |
| 1551 | Godwyn, John                                                  |                    |          | ORO 185/117                  |
| 1555 | DORRELL, Dorell, Edmund                                       |                    |          | D/A/We/8/97                  |
| 1555 | ROSELL, William                                               |                    |          | D/A/Wf/2/250                 |
| 1556 | [WITHINGTON, Wythingto[n], James](/wills/james-withington.md) | (vicar), clerk     |          | D/A/We/8/197 D/A/Wf/2/367    |
| 1557 | Darell, Elizabeth                                             |                    |          | D/A/Wf/3/72                  |
| 1557 | Tryppe, James                                                 |                    |          | D/A/Wf/3/246                 |
| 1557 | TYTING, Thomas                                                | (vicar of), priest |          | D/A/We/10/32 D/A/Wf/3/241    |
| 1558 | Godwyne, Edmund (Yemmant)                                     |                    |          | D/A/We/12/94 D/A/Wf/4/144    |
| 1558 | Goddyne, Thomas                                               |                    |          | D/A/We/12/101 D/A/Wf/4/145   |
| 1559 | Darell, John                                                  |                    |          | D/A/We/12/38 D/A/Wf/4/104    |
| 1559 | OLD, William                                                  |                    |          | D/A/We/154/219 D/A/Wf/5/160  |
| 1560 | MEAD, Richard                                                 | husbandman         |          | D/A/We/13/39 D/A/Wf/5/330    |
| 1568 | SWAYNSON, Richard                                             | vicar              |          | D/A/We/16/163                |
| 1573 | Trippe, James                                                 |                    | £39-10-8 | D/A/We/17/1                  |
| 1573 | Tryppe, John                                                  |                    | £11-18-2 | D/A/Wf/7/221                 |
| 1576 | RALEGHE, Thomas                                               | gentleman, nuncup  |          | D/A/Wf/8/156                 |
| 1579 | DORRELL, William (younger)                                    |                    |          | D/A/Wf/8/312                 |
| 1584 | DARRELL, Eleanor                                              |                    |          | D/A/Wf/10/30                 |
| 1593 | ?, William                                                    | husbandman, nuncup |          | D/A/Wf/12/173                |
| 1593 | ROBINS, James                                                 | husbandman         |          | D/A/Wf/12/253                |
| 1597 | HESTER, William                                               | husbandman         |          | D/A/Wf/13/254                |
| 1598 | Robyns, Agnes                                                 |                    |          | D/A/We/154/268 D/A/Wf/14/108 |
| 1607 | Yonge, Matthew                                                | husbandman         |          | D/A/Wf/17/249                |
| 1612 | WRIGHT, Martin                                                | clerk              |          | D/A/We/24/211 D/A/Wf/19/276  |
| 1619 | Younge, John                                                  | husbandman         |          | D/A/We/27/6                  |
| 1619 | Edmund (elder)                                                | husbandman         |          | D/A/We/27/238 D/A/Wf/23/83   |
| 1623 | BIGG, Bigge, Christopher                                      | yeoman             |          | D/A/We/28A/145 D/A/Wf/24/239 |
| 1631 | Boudo[n], Katherine                                           | widow              |          | D/A/Wf/28/214                |
| 1635 | ?, William                                                    | husbandman         |          | D/A/We/30/202 D/A/Wf/30/222  |
| 1637 | GODDEN, William                                               | admin              |          | D/A/We/149/16                |
| 1638 | Brookes, Edmund                                               | husbandman         |          | D/A/We/32/139 D/A/Wf/32/129  |
| 1639 | ROBINS, Martin                                                | batchelor, nuncup  |          | D/A/We/33/164 D/A/Wf/33/195  |

_nuncup or nuncupative means the will was given orally_

_[D/A/V/1](https://archives.buckinghamshire.gov.uk/records/D-A/V/1) are the Proceedings of visitation courts including copies of wills proved at the visitations Jan 1491/2 - Apr 1495_

William Trippe's will was contested. Records of Buckinghamshire, Bucks Archaeological Society [Ragg, Rev. F. W., 'Fragments of folio MS of Archdeaconry courts of Buckinghamshire 1491-5'](http://www.bucksas.org.uk/rob/rob_11_2_59.pdf) translates the entry as:

> Edmund Bolles at the instance of William Trippe in a case of impeding the last will of William Trippe, deceased.
> The parties appeared and mutually agreed to stand by the award of the rector of Aston and the Vicar of Ilmer, whatever the terms;
> under penalty of 10s. half of which should go to the parish church and the other half to the office provided that the award was given within the feast of Michaelmas next to come.
> Agreement and the ease dismissed.

Trippe was also mentioned in [Part I](http://www.bucksas.org.uk/rob/rob_11_1_27.pdf) of the above folio:

> William Trippe George Boll Richard Hester William Darell Margery Ilbert (cited)
> at the instance of the Churchwardens here in a case of withholding the rights of the Church. \
> The aforesaid William admits a debt of 12s. 6d. \
> George Boll of 13s. 2d. \
> Richard Hester of 14s. 4d. \
> William Darell of 3s. 4d. \
> Margery Ilbert of 4s. \
> Condemnation followed and they were enjoined to pay half before
> the Feast of the Nativity of the Lord and the other half before
> the Feast of the Purification of the Blessed Mary the
> Virgin, under penalty of excommunication

#### Prerogative Court of Canterbury

| Name                  | Occupation | Date       | Reference       |
| --------------------- | ---------- | ---------- | --------------- |
| Heabarne, Thomas sen  | yeo        | 1653       | 358             |
| Young, Younge William | widr       | 1659       | 140             |
| Saunders, Thomas      |            | 1 Sep 1684 | PROB 6/59 f.145 |

#### Lincoln Wills & Administrations Index

| Name              | Date       | Reference |
| ----------------- | ---------- | --------- |
| Meade, Wm.        | 1557       | i, 94     |
| Browne, Jo.       | 1563-6 & 9 | 197       |
| \*Coningsbie, Su. | 1583       | ii, 248   |
| Smarte, St.       | 1588       | i, 32     |
| Tupp, Edm.        | 1588       | i, 29     |

#### Testators residing outside Lincolnshire.

| Name   | Location |
| ------ | -------- |
| Bowden | Ilmer    |
