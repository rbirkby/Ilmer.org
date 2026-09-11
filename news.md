---
layout: post
permalink: /newsroom/index.html
title: 'This Week in History'
description: 'Historical events, baptisms, marriages, burials and wills that fall on these dates in years past.'
tags: []
---

<script type="module" src="{{ '/assets/js/weekly-news.js' | cacheBust }}"></script>
<div data-weekly-news data-look-ahead-days="7">
  <script type="application/json" data-events>
    [{% for event in weeklyNewsEvents %}{"date":{{ event.date | jsonify }},"title":{{ event.title | jsonify }},"url":{{ event.url | jsonify }},"category":{{ event.category | jsonify }}}{% unless forloop.last %},{% endunless %}{% endfor %}]
  </script>
  <p>Loading this week's history&hellip;</p>
</div>
