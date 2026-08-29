---
layout: post
title: 'Domesday'
description: 'The Domesday book of 1086'
category: history
tags: [post]
image: images/domesday-buk-04.png
useArchiveCss: true
---

In Ilmer Robert (d'Oilly) holds 4 hides from the Bishop [Odo of Bayeux]. Land for 5 ploughs; in lordship 2. 8 villagers with 1 smallholder have 3 ploughs. 4 slaves; 1 mill at 10s; meadow for 5 ploughs. Value £4; when acquired 100s; before 1066 as much. Godwin, Earl Leofwin's man, held this manor; he could sell.

<style>
  /* Native folio is 832×1123. Hole is left, top, right, bottom in those pixels. */
  p:has(img[src*='domesday-buk-04']) {
    --folio-w: 832;
    --folio-h: 1123;
    --hole-left: 100;
    --hole-top: 710;
    --hole-right: 452;
    --hole-bottom: 808;
    --hole-x: calc(var(--hole-left) / var(--folio-w) * 100%);
    --hole-y: calc(var(--hole-top) / var(--folio-h) * 100%);
    --hole-w: calc((var(--hole-right) - var(--hole-left)) / var(--folio-w) * 100%);
    --hole-h: calc((var(--hole-bottom) - var(--hole-top)) / var(--folio-h) * 100%);
  }

  p:has(img[src*='domesday-buk-04']) img {
    display: block;
  }

  p:has(img[src*='domesday-buk-04'])::after {
    content: '';
    position: absolute;
    inset: 0;
    background: rgb(0 0 0 / 0.3);
    pointer-events: none;
    mask-image: linear-gradient(#000 0 0), linear-gradient(#000 0 0);
    mask-size: 100% 100%, var(--hole-w) var(--hole-h);
    mask-position: 0 0, var(--hole-x) var(--hole-y);
    mask-repeat: no-repeat;
    mask-composite: exclude;
  }
</style>

![](/images/domesday-buk-04.png)

Domesday image [CC-BY-SA](http://creativecommons.org/licenses/by-sa/3.0/).
Credits: Professor John Palmer, George Slater, [opendomesday.org](https://opendomesday.org/)
