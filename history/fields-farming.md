---
layout: post
title: 'Fields and farming'
description: 'The fields and farms of Ilmer'
tags: [history, post]
image: images/1778PlanOfTheParishOfIlmer.avif
scrollAllTables: true
---

According to [Lipscomb](https://archive.org/details/historyantiquiti01lips/page/n167/mode/2up), Ilmer manor had been enclosed into private fields by 1657. The enclosure process began much earlier (over a century before) when [Walter Curson](https://archive.org/details/bwb_KV-352-031_1/page/n5/mode/2up) enclosed sixty acres he leased from Lady Mary Hungerford.

### Farms

<ul>
{%- for item in collections.farm -%}
    <li><a href="{{ item.url }}">{{ item.data.title }}</a></li>
{%- endfor -%}
</ul>

### Lease plans

The leases of Lower Farm, Middle Farm and Coldharbour Farm each came with a sketch plan of the fields let and a schedule of their names and areas. The field numbers run in one sequence across all three plans, so they appear to have been copied from a single estate map, but they are not the numbers used on the 1839 Tithe map.

The map below combines the three plans. Each plan has been turned so that north is up, using the north arrows drawn on the Lower Farm and Middle Farm plans, and scaled to the acreages in the schedules. The Coldharbour Farm plan has no north arrow, so it is shown as drawn. The plans are sketches rather than surveys, so the field shapes are schematic and the positions of the three farms relative to each other are approximate. The Middle Farm schedule has not been found, so its fields are shown by number only.

<ilmer-lease-map></ilmer-lease-map>
<script type="importmap">
{ "imports": { "/assets/js/ilmer-lease-fields-data.js": "{{ '/assets/js/ilmer-lease-fields-data.js' | cacheBust }}" } }
</script>
<script type="module" src="{{ '/assets/js/ilmer-lease-map.js' | cacheBust }}"></script>

#### Lower Farm schedule

The letters after each name are m for meadow, p for pasture and a for arable. The fields add up to 127a 2r 6p, 20 perches less than the total written on the schedule. Little mead (20) and the open field land are not drawn on the plan.

| No  | Contents             | Use |       A |     R |      P |
| :-: | :------------------- | :-: | ------: | ----: | -----: |
| 11  | Picked mead          |  m  |       6 |     1 |      0 |
| 12  | Long mead            |  m  |       9 |     0 |      0 |
| 19  | Cole harbour         |  a  |       9 |     0 |      8 |
| 20  | Little mead          |  m  |       1 |     1 |     12 |
| 35  | Old orchard          |  p  |       2 |     0 |     28 |
| 44  | House and yard       |     |       0 |     1 |     33 |
| 45  | Orchard              |  p  |       0 |     1 |     18 |
| 46  | Old Marys            |  p  |       0 |     3 |     24 |
| 47  | Monks close          |  p  |       2 |     1 |      8 |
| 48  | Old Joes close       |  p  |       2 |     0 |     20 |
| 50  | Hogs piece           |  a  |       8 |     2 |     14 |
| 51  | Sheep ground         |  p  |      11 |     3 |      8 |
| 58  | Old Joes             |  a  |       7 |     1 |     10 |
| 59  | Middle close         |  a  |      10 |     0 |      2 |
| 60  | Home close           |  a  |       6 |     2 |      0 |
| 61  | Upper Plat           |  p  |       0 |     3 |      4 |
| 62  | Lower Plat           |  p  |       2 |     0 |     10 |
| 63  | Green Iliner Highway |  p  |       6 |     2 |     12 |
| 64  | Little meadow        |  m  |       1 |     0 |      8 |
| 65  | Great meadow         |  m  |      16 |     2 |     13 |
| 66  | Green Iliner         |  m  |      18 |     1 |     35 |
|     | Open field land      |     |       3 |     3 |     19 |
|     | **Total**            |     | **127** | **2** | **26** |

#### Coldharbour Farm schedule

| No  | Contents    |      A |     R |      P |
| :-: | :---------- | -----: | ----: | -----: |
| 16  | House &c    |      0 |     2 |     35 |
| 10  | Far Meadow  |      1 |     2 |     20 |
| 14  | Far Ground  |      6 |     3 |     30 |
| 15  | Home Ground |      6 |     1 |      0 |
| 18  | Backside    |      0 |     3 |     26 |
|     | **Total**   | **16** | **1** | **33** |

These fields add up to 16a 1r 31p, 2 perches less than the written total.

### Tithe Map

By 1839, when the Tithe map was created, the field layout had stabilised into a pattern still visible in the landscape today, though some smaller fields have subsequently been consolidated.

- [Tithe apportionment file](/history/tithe-file) for Ilmer following the Tithe Commutation Act of 1836.

[Explore Ilmer in 1839 in 3D](/history/ilmer-1839/) - an interactive reconstruction of the village map crop, distinguishing map and photographic evidence from inferred architecture and landscape.

In the tables below, A. R. P. are Acres, Roods and Perches. A rood is ¼ of an acre and there are 40 perches to a rood

#### MORETON, JOHN EDWd FREWEN

##### John Egleton, Tenant

| No  | Name                           | Description of Premises |       A |     R |      P |
| :-: | :----------------------------- | :---------------------: | ------: | ----: | -----: |
|  1  | The Middle Farm Homestead      |                         |       1 |     2 |     29 |
|  5  | Robinsons                      |         pasture         |      19 |     2 |     10 |
|  8  | Old Brook                      |           dº            |       2 |     0 |     21 |
| 19  | Godding's Highway              |           dº            |       1 |     0 |     38 |
| 32  | Godding's                      |           dº            |       9 |     1 |      8 |
| 36  | Little Littlemoor              |         Meadow          |       2 |     3 |     24 |
| 37  | Great Littlemoor               |           dº            |      25 |     1 |     19 |
| 38  | Sheep Ground                   |         Arable          |      27 |     2 |     16 |
| 39  | Far Ploughed piece             |           dº            |      15 |     3 |     15 |
| 40  | Hither ploughed piece          |           dº            |      16 |     3 |     28 |
| 41  | The Plots                      |         pasture         |      19 |     2 |     15 |
| 41a | Site of two Cottages & Gardens |                         |       0 |     0 |     23 |
| 42  | Upper fatting Ground           |         pasture         |      10 |     3 |      0 |
| 55  | Lower fatting Ground           |           dº            |       6 |     0 |     18 |
| 56  | Ploughed fatting Ground        |         Arable          |      11 |     2 |     13 |
| 57  | Saintfoin Field                |           dº            |       5 |     0 |     22 |
| 58  | The Lake                       |         Meadow          |      12 |     1 |      2 |
|  2  | Old Orchard                    |         pasture         |       4 |     0 |     24 |
| 2a  | dº (late Wooster's)            |           dº            |       2 |     1 |     13 |
| 2b  | Paddock                        |           dº            |       0 |     1 |     37 |
| 2c  | Old Garden                     |           dº            |       0 |     1 |     11 |
| 2d  | Old Lane                       |           dº            |       0 |     0 |     28 |
|  4  | Upper Burn Way                 |           dº            |       4 |     0 |     29 |
|  6  | Road way                       |           dº            |       0 |     3 |     23 |
|  7  | Lower Burnway                  |           dº            |       3 |     2 |     27 |
|  9  | Illmire Leys                   |           dº            |      17 |     3 |     19 |
| 10  | Wicket pit Mead                |           dº            |       1 |     3 |      6 |
| 11  | Little Ground                  |           dº            |       8 |     2 |     14 |
| 12  | Haden pen                      |           dº            |       4 |     2 |     19 |
| 13  | Great Ground                   |           dº            |      12 |     2 |      0 |
| 18  | Gomme's Piece                  |           dº            |       6 |     3 |      0 |
| 33  | Little ploughed piece          |         Arable          |       2 |     1 |     33 |
| 34  | Dick's Little Moor             |         pasture         |       9 |     2 |      0 |
| 35  | Grace's Meadow                 |           dº            |       6 |     0 |     25 |
|     | **Total**                      |                         | **276** | **2** | **11** |

##### Ann Wooster, Tenant

| No  | Name                            | Description of Premises |       A |     R |     P |
| :-: | :------------------------------ | :---------------------: | ------: | ----: | ----: |
| 47  | The Lower Farm Homestead & yard |                         |       0 |     1 |     4 |
| 31  | Cold Harbour                    |         Arable          |       9 |     1 |     0 |
| 43  | Sheep Ground                    |         pasture         |      11 |     3 |    35 |
| 44  | Hog piece                       |         Arable          |       8 |     1 |    25 |
| 45  | Home Close                      |         pasture         |       2 |     2 |    28 |
| 45a | Old Joes                        |           dº            |       2 |     1 |    13 |
| 45b | Monk's Close                    |           dº            |       2 |     0 |    34 |
| 46  | Site of 3 Tenements & Gardens   |                         |       0 |     1 |     4 |
| 48  | Old Mary's Close                |         pasture         |       0 |     3 |    28 |
| 49  | Lower Farm Homestead & Orchard  |                         |       0 |     3 |    34 |
| 50  | Upper Plot                      |         pasture         |       0 |     3 |     1 |
| 51  | Lower dº                        |           dº            |       2 |     1 |     1 |
| 52  | Home Close                      |         Arable          |       6 |     1 |    30 |
| 53  | Middle Close                    |           dº            |      10 |     1 |     2 |
| 54  | Old Joe's Close                 |           dº            |       2 |     1 |     3 |
| 59  | Great Meadow                    |         Meadow          |      10 |     1 |     0 |
| 60  | Little Meadow                   |           dº            |       1 |     0 |    13 |
| 61  | Green Illmire                   |         pasture         |      19 |     1 |    38 |
| 62  | dº Highway                      |           dº            |       6 |     3 |    11 |
| 63  | Frizze's piece                  |         Arable          |       9 |     1 |    17 |
|     | **Total**                       |                         | **119** | **1** | **2** |

##### Hannah Gomme, Tenant

| No  | Name                          | Description of Premises |       A |     R |      P |
| :-: | :---------------------------- | :---------------------: | ------: | ----: | -----: |
| 29  | Cold Harbour Farm Homestead   |                         |       0 |     2 |     17 |
| 20  | Badger's Plat                 |         pasture         |       1 |     1 |     28 |
| 21  | Betty's Mead                  |           dº            |       6 |     0 |      5 |
| 22  | Little Meadow                 |           dº            |       1 |     1 |     19 |
| 23  | Far Meadow                    |           dº            |       1 |     2 |      8 |
| 24  | Picked Mead                   |         Meadow          |       7 |     0 |     35 |
| 25  | Long Mead                     |           dº            |       8 |     1 |     24 |
| 26  | Far Ground                    |         pasture         |       6 |     3 |     21 |
| 27  | Home Ground                   |           dº            |       5 |     3 |     30 |
| 28  | The park                      |           dº            |       0 |     1 |     29 |
| 30  | Backside                      |           dº            |       0 |     3 |      4 |
|     | **Total**                     |                         |  **40** | **2** | **20** |
|     | **Total of M. J.E. Frewen's** |                         | **436** | **1** | **33** |

#### ADMIRAL HENRY RAPER

##### John Tapping, Tenant

|  No  | Name                           | Description of Premises |       A |     R |     P |
| :--: | :----------------------------- | :---------------------: | ------: | ----: | ----: |
| A1&2 | Upper Farm Homestead & Orchard |                         |       2 |     2 |    21 |
|  A7  | Frizze's piece                 |         Arable          |       3 |     2 |    39 |
|  A5  | part of Home Field             |           dº            |      11 |     1 |     8 |
|  A6  | part of Lockington Field       |           dº            |      10 |     2 |    32 |
|  A3  | Farm Leys                      |         pasture         |       9 |     3 |     1 |
|  A4  | Frizze's Close                 |           dº            |       5 |     2 |    10 |
|  A8  | Acreage Way                    |           dº            |       2 |     1 |    36 |
| A10  | Great Ground                   |           dº            |      41 |     3 |     5 |
|  A9  | The Grove                      |           dº            |      20 |     2 |    16 |
| A11  | The Lake                       |         Meadow          |      17 |     0 |    21 |
| A12  | Field's End                    |         Arable          |      39 |     2 |    19 |
| A13  | Upper New Close                |           dº            |      20 |     0 |    12 |
| A14  | Lower New Close                |           dº            |      22 |     2 |    20 |
| A17  | Mill Leys                      |         pasture         |       6 |     3 |     9 |
| A16  | Seven Acres                    |           dº            |      12 |     2 |    23 |
| A15  | Four Acres                     |           dº            |       3 |     3 |    12 |
|      | **Total**                      |                         | **231** | **0** | **4** |

#### TRUSTEES OF CHURCH LAND, viz THE VICAR AND CHURCHWARDENS OF ILLMIRE

##### John Tapping, Tenant

| No  | Name         | Description of Premises |   A |   R |   P |
| :-: | :----------- | :---------------------: | --: | --: | --: |
| 67  | Church Close |         Arable          |   1 |   3 |  34 |

#### THE REVD W.M EDWARDS PARTRIDGE

##### Vicarial Glebe

| No  | Name                       | Description of Premises |     A |     R |     P |
| :-: | :------------------------- | :---------------------: | ----: | ----: | ----: |
| 66  | Church Yard                |         pasture         |     0 |     2 |     1 |
| 64  | Orchard                    |           dº            |     0 |     1 |     6 |
| 65  | Vicarage House, Garden &c. |                         |     0 |     0 |    36 |
|     | **Total**                  |                         | **1** | **0** | **3** |

#### Totals (except cottages, roads and waste)

|                 |       A |     R |      P |
| :-------------- | ------: | ----: | -----: |
| **Ilmer Total** | **670** | **1** | **34** |

#### Cottages, Roads & Waste

| No  | Name                                |     A |     R |      P |
| :-: | :---------------------------------- | ----: | ----: | -----: |
| 68  | Scites of Parish Cottages & Gardens |     0 |     0 |     36 |
|     | Public Roads & Waste                |     3 |     2 |     33 |
|     | **Total**                           | **3** | **3** | **29** |

#### Totals

|                                                             |       A |     R |      P |
| :---------------------------------------------------------- | ------: | ----: | -----: |
| **Ilmer Total, including Cottages, Gardens, Roads & Waste** | **674** | **1** | **23** |
