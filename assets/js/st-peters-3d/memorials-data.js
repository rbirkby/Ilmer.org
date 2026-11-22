// Plotted churchyard memorials derived from _data/st-peters-churchyard-plan.json
// and monumental-inscriptions/[BC]*.md (1985 Rex Kidd / 2007 Jenny Peel survey).
// Grid: row increases Eastward (church spans row 8..28), col increases Northward (church spans col 29..38).

export const CHURCHYARD_MEMORIALS = [
  {
    id: 'B1',
    section: 'B',
    col: 49,
    row: 22,
    kind: 'headstone',
    // Turned to face the church, with a wooden bench beside it on its left
    facesChurch: true,
    benchOnLeft: true,
    stone: 'granite',
    inscription: [
      'In ever loving',
      'memory of',
      'a dear husband',
      'and father',
      'Roy',
      'Charles',
      'MADGWICK',
      'who entered into rest',
      '4 Feb 1997',
      'aged 67 years',
      'his life a',
      'precious memory',
      'his absence',
      'a silent grief'
    ]
  },
  {
    id: 'B2',
    section: 'B',
    col: 46,
    row: 3,
    kind: 'headstone',
    stone: 'buff',
    inscription: [
      'In loving memory',
      'of',
      'James KINGHAM',
      'who died November 10 1907',
      'aged 79 years',
      '',
      'Also of Anne',
      'his beloved wife',
      'who died March 3 1900',
      'aged 62 years',
      'peace perfect peace'
    ]
  },
  {
    id: 'B3',
    section: 'B',
    col: 43,
    row: 4,
    kind: 'headstone',
    stone: 'limestone',
    inscription: [
      'In',
      'loving memory',
      'of',
      'Albert KINGHAM',
      'died 29 Jan 1969',
      'aged 81 years',
      '',
      'Also his wife',
      'Florence',
      'died 21st July 1980',
      'aged 93 years'
    ]
  },
  {
    id: 'B4',
    section: 'B',
    col: 42,
    row: 6,
    kind: 'headstone',
    stone: 'limestone',
    inscription: [
      'In',
      'affectionate memory of',
      'David CLAYDON',
      'passed to higher service',
      'July 13th 1973',
      'aged 74 years',
      'blessed are the pure in heart',
      'for they shall see God',
      '',
      'And his dearly loved wife',
      'Constance Mary CLAYDON',
      'who died February 6th 1977',
      'aged 78 years'
    ]
  },
  {
    id: 'B5',
    section: 'B',
    col: 42,
    row: 8,
    kind: 'headstone',
    stone: 'granite',
    inscription: [
      'Mark CLAYDON',
      'a devoted husband and father',
      '1905 - 1978',
      'remembered with love',
      '',
      'Also his wife',
      'Freda',
      '1915 - 1981',
      'always remembered',
      'with love'
    ]
  },
  {
    id: 'B7',
    section: 'B',
    col: 45,
    row: 1,
    kind: 'plaque',
    stone: 'limestone',
    inscription: ['In loving memory', 'of', 'Richard James WILSON', '12 April 1938 - 9 July 2007', "Tha' knows"]
  },
  {
    id: 'C1',
    section: 'C',
    col: 2,
    row: 31,
    kind: 'headstone',
    stone: 'limestone',
    inscription: [
      'In loving memory',
      'David RUTHERFORD',
      '1949 - 1989',
      'at peace',
      '',
      'Josephine Janette',
      'RUTHERFORD',
      '1919 - 1992',
      'God Almighty first planted',
      'a garden',
      'and indeed it is the purest',
      'of human pleasures'
    ]
  },
  {
    id: 'C2',
    section: 'C',
    col: 4,
    row: 31,
    kind: 'headstone',
    stone: 'limestone',
    inscription: [
      'Major Robert James',
      'RUTHERFORD',
      '(Royal Scots)',
      '10th January 1919',
      '25th November 1992',
      'pray for me as I will for thee',
      'that we may meet merrily',
      'in heaven'
    ]
  },
  {
    id: 'C3',
    section: 'C',
    col: 9,
    row: 31,
    kind: 'marker',
    stone: 'wood',
    inscription: ['Ronald GOMME']
  },
  {
    id: 'C4',
    section: 'C',
    col: 12,
    row: 31,
    kind: 'headstone',
    stone: 'granite',
    inscription: [
      'Treasured',
      'memories of',
      'a dear husband',
      'dad and grandad',
      'William',
      'RANKIN',
      'taken from us',
      '25th December 1995',
      'aged 58 years',
      'rest in peace'
    ]
  },
  {
    id: 'C5',
    section: 'C',
    col: 15,
    row: 31,
    kind: 'plaque',
    stone: 'limestone',
    inscription: ['In loving memory', 'of', 'Charlotte Campbell', 'PURVER', '13-05-1925 - 15-03-2003']
  },
  {
    id: 'C6',
    section: 'C',
    col: 18,
    row: 31,
    kind: 'headstone',
    stone: 'granite',
    inscription: ['Susan DEVANEY', 'died 12th March 2007', 'aged 78 years']
  },
  {
    id: 'C7',
    section: 'C',
    col: 21,
    row: 31,
    kind: 'marker',
    stone: 'wood',
    inscription: ['Shirley STEVENSON']
  },
  {
    id: 'C8',
    section: 'C',
    col: 12,
    row: 26,
    kind: 'headstone',
    stone: 'buff',
    inscription: [
      'In',
      'loving memory',
      'of',
      'Hannah GOMME',
      'called home 11th November 1933',
      'aged 68 years',
      '',
      'And',
      'George GOMME',
      'husband of the above',
      'who passed away 24th January 1945',
      'aged 80 years',
      'erected by their children and grandchildren',
      'in England and U.S.A.'
    ]
  },
  {
    id: 'C9',
    section: 'C',
    col: 26,
    row: 26,
    kind: 'open-book-kerbs',
    stone: 'granite',
    pages: [
      [
        'In',
        'loving',
        'memory of',
        'a dear husband',
        'and father',
        'Arthur',
        'Alexander',
        'STARLING',
        'who fell asleep',
        '3rd Dec 1970',
        'aged 65 years',
        'sadly missed',
        "God's finger touched him and he slept",
        'only goodnight beloved , not farewell'
      ],
      [
        'Also in loving',
        'memory of',
        'a dear wife and mother',
        'Annie',
        'who fell asleep',
        '22nd Oct 1991',
        'aged 81 years',
        'together again'
      ]
    ]
  },
  {
    id: 'C10',
    section: 'C',
    col: 2,
    row: 20,
    kind: 'headstone-kerbs',
    stone: 'limestone',
    inscription: [
      'In loving remembrance',
      'of',
      'Edward Albert GOODCHILD',
      "who passed into God's keeping",
      'Aug 16th 1934',
      'aged 32 years'
    ]
  },
  {
    id: 'C11',
    section: 'C',
    col: 6,
    row: 20,
    kind: 'celtic-cross-chains',
    stone: 'granite',
    inscription: [
      'To the memory of',
      'a dear husband and father',
      'Albert GOODCHILD',
      'who entered into rest',
      'July 15th 1931',
      'aged 57 years',
      "in God's keeping"
    ]
  },
  {
    id: 'C12',
    section: 'C',
    col: 10,
    row: 20,
    kind: 'headstone-kerbs',
    stone: 'limestone',
    inscription: [
      'In',
      'loving memory',
      'of',
      'Alfred HILL',
      'who died',
      'April 5th 1926',
      'aged 83 years',
      'peace perfect peace'
    ]
  },
  {
    id: 'C13',
    section: 'C',
    col: 13,
    row: 20,
    kind: 'headstone-fallen',
    stone: 'buff',
    inscription: [
      'HIS.',
      'in loving memory of',
      'Eliza Jane HILL',
      'wife of',
      'Alfred HILL',
      'who died November 6th 1910',
      'aged 62 years',
      'sleep on beloved, sleep on and take',
      'thy rest'
    ]
  },
  {
    id: 'C14',
    section: 'C',
    col: 18,
    row: 20,
    kind: 'headstone-fallen',
    stone: 'buff',
    inscription: [
      'HIS.',
      'in loving memory of',
      'Henry GOMME',
      '(of Cold Harbour, Ilmer)',
      'who died May 5th 1879',
      'aged 78 years',
      '',
      'Also of Sarah Jane',
      'his wife',
      'who died April 18th 1881',
      'aged 70 years',
      '',
      'Also of Hannah GOMME',
      'his sister',
      'who died Sepbr 27th 1884',
      'aged 90 years',
      'asleep in Jesus'
    ]
  },
  {
    id: 'C15',
    section: 'C',
    col: 24,
    row: 24,
    kind: 'plaque',
    stone: 'granite',
    inscription: [
      'Robert Harold',
      'ATTENBOROUGH',
      '1880 - 1968',
      '',
      'Also',
      'Grace Elizabeth',
      'ATTENBOROUGH',
      '1887 - 1980'
    ]
  },
  {
    id: 'C16',
    section: 'C',
    col: 26,
    row: 24,
    kind: 'plaque',
    stone: 'granite',
    inscription: [
      'Together in life',
      'reunited forever',
      'God bless sweetie',
      'Mavis HEAD',
      '1908 - 2000',
      '',
      'Also her husband',
      'Frank HEAD',
      '1912 - 2001'
    ]
  },
  {
    id: 'C17',
    section: 'C',
    col: 2,
    row: 12,
    kind: 'headstone',
    stone: 'limestone',
    inscription: ['In', 'loving memory', 'of', 'Ernest John', 'GOODCHILD', 'died Aug 28 1968', 'aged 39 years']
  },
  {
    id: 'C18',
    section: 'C',
    col: 6,
    row: 12,
    kind: 'headstone-kerbs',
    stone: 'granite',
    inscription: [
      'In loving memory of',
      'Owen GOODCHILD',
      'died March 10th 1932',
      'aged 54 years',
      '',
      'Also of his wife',
      'Katie Louisa',
      'died July 24th 1935',
      'aged 61 years',
      'RIP'
    ]
  },
  {
    id: 'C19',
    section: 'C',
    col: 8,
    row: 12,
    kind: 'headstone',
    stone: 'buff',
    inscription: [
      'In loving memory of',
      'Thomas GOODCHILD',
      'who died Oct 3rd 1930',
      'aged 67 years',
      'Thy will be done',
      '',
      'Also of Mary',
      'beloved wife of the above',
      'who died June 15th 1933',
      'aged 72 years',
      'peace perfect peace'
    ]
  },
  {
    id: 'C20',
    section: 'C',
    col: 10,
    row: 12,
    kind: 'headstone',
    stone: 'limestone',
    inscription: [
      'In loving memory',
      'of',
      'Annie GOODCHILD',
      'died 26th April 1964',
      'aged 74',
      '',
      'And her beloved husband',
      'Harry',
      'died 26th April 1973',
      'aged 84',
      'reunited'
    ]
  },
  {
    id: 'C21',
    section: 'C',
    col: 18,
    row: 12,
    kind: 'headstone-kerbs',
    stone: 'limestone',
    inscription: [
      'To',
      'the blessed memory of',
      'John Thomas CLAYDON',
      'of Longwick',
      'died Aug 14 1936 aged 71 years',
      '',
      'And Charlotte his beloved wife',
      'who died Nov 14th 1943 aged 77 years',
      '',
      'Also Ruth their daughter',
      'who died Jan 6th 1937',
      'aged 42 years',
      'worthy of everlasting remembrance'
    ]
  },
  {
    id: 'C22',
    section: 'C',
    col: 16,
    row: 10,
    kind: 'cross-headstone',
    stone: 'buff',
    inscription: [
      'In',
      'loving memory',
      'of Martha BELGROVE',
      'who died September 10th 1909',
      'aged 44 years',
      'for 25 years organist at this church',
      'if Thou shouldst call me to resign',
      "what most I prize it ne'er was mine",
      'I only yield Thee what is Thine',
      'Thy will be done',
      '',
      'MB 1909'
    ]
  },
  {
    id: 'C23',
    section: 'C',
    col: 10,
    row: 6,
    kind: 'open-book',
    stone: 'limestone',
    pages: [
      [
        'In ever loving',
        'memory of',
        'Horace',
        'George',
        'RICHARDSON',
        'aged 79',
        'passed away',
        '22nd Oct 1990',
        'very dear husband',
        'dad and grandad',
        'and',
        'great grandad'
      ],
      [
        'In ever loving',
        'memory of',
        'Edith Lille',
        'RICHARDSON',
        'aged 85',
        'passed away',
        '29 Mar 2000',
        'a loving mum',
        'nan and great nan',
        'reunited with dad',
        'rest in peace'
      ]
    ]
  },
  {
    id: 'C24',
    section: 'C',
    col: 13,
    row: 6,
    kind: 'cross-kerbs',
    stone: 'limestone',
    inscription: [
      'In',
      'loving memory of',
      'Alice RICHARDSON',
      'who died May 13th 1933 aged 60 years',
      'rest after weariness',
      'sweet rest at last',
      '',
      'Alfred Nathaniel RICHARDSON',
      'who died August 20th 1946',
      'aged 73 years',
      'reunited'
    ],
    plaques: [
      [
        'In loving memory of',
        'William',
        'RICHARDSON',
        '1908 - 1992',
        'And his wife',
        'Winifred Beatrice',
        '1911 - 2002'
      ],
      [
        'In loving memory of',
        'Ruth Lydia',
        'ROGERS',
        'nee RICHARDSON',
        '1904 - 1986',
        'And of',
        'Frank ROGERS',
        '1900 - 1981'
      ]
    ]
  },
  {
    id: 'C25',
    section: 'C',
    col: 17,
    row: 6,
    kind: 'cross-kerbs',
    stone: 'limestone',
    inscription: [
      'In',
      'loving memory',
      'of',
      'Blanche G. RICHARDSON',
      'died June 21st 1923',
      'aged 16 years.',
      '',
      'Also of Maurice V. D. RICHARDSON.',
      'died Jan. 12th 1924',
      'aged 8 years',
      '',
      'Also of',
      'Gladys BAKER',
      'died Nov 19th 1924',
      'aged 3 days',
      '',
      'Also of',
      'Cpl. Albert',
      'E. RICHARDSON',
      'who died of wounds',
      'in France',
      'Sept. 11th 1918.',
      'aged 23 years.'
    ]
  },
  {
    id: 'C26',
    section: 'C',
    col: 20,
    row: 6,
    kind: 'headstone',
    stone: 'limestone',
    inscription: [
      'But O for the touch of',
      'a vanished hand',
      'and the sound of',
      'a voice that is still',
      'Jack Murray CREASER',
      '31st May 1986 to',
      '4th August 1989',
      'Jack loved',
      'he is loved',
      'to us he is',
      'the best boy',
      'in the whole world'
    ]
  },
  {
    id: 'C27',
    section: 'C',
    col: 22,
    row: 6,
    kind: 'open-book-kerbs',
    stone: 'limestone',
    pages: [
      [
        'In',
        'loving memory',
        'of a dear wife',
        'and mother',
        'Nora May',
        'BAILEY',
        'passed away',
        'April 2 1965',
        'aged 54 years',
        'loved and',
        'remembered',
        'always'
      ],
      [
        'Also in',
        'loving memory of',
        'a dear husband',
        'and father',
        'Leslie',
        'BAILEY',
        'who fell asleep',
        'Jan 12 1996',
        'aged 84 years',
        'forever',
        'in our',
        'thoughts'
      ]
    ]
  },
  {
    id: 'C28',
    section: 'C',
    col: 24,
    row: 6,
    kind: 'open-book',
    stone: 'limestone',
    pages: [
      ['Cherished', 'memories of', 'a dear loved', 'son and brother', 'Mark Anthony STOW B.Sc 2 Lt T.A.V.R.'],
      ['taken from us', '31st January', '1976', 'aged 22', 'auf wiedersehen']
    ]
  },
  {
    id: 'C29',
    section: 'C',
    col: 26,
    row: 6,
    kind: 'plaque',
    stone: 'limestone',
    inscription: [
      'Remembered with love',
      'Lt Col D M STOW M.B.E.',
      '1st Btn The Green Howards',
      '14th Sept 1926 - 24th Sept 1992',
      'sadly missed by his wife Vera',
      'sons and grandchildren',
      'until we meet again'
    ]
  },
  {
    id: 'C30',
    section: 'C',
    col: 28,
    row: 6,
    kind: 'marker',
    stone: 'wood',
    inscription: ['Vera Christina', 'Dawn STOW', 'died 24th June 2004', 'aged 76 years']
  },
  {
    id: 'C31',
    section: 'C',
    col: 9,
    row: 3,
    kind: 'open-book',
    stone: 'limestone',
    pages: [
      ['In loving', 'memory of', 'Peter W', 'RICHARDSON', 'devoted husband'],
      ['dad and', 'brother', 'passed away', '11-9-2005', 'aged 56 years']
    ]
  },
  {
    id: 'C32',
    section: 'C',
    col: 11,
    row: 3,
    kind: 'headstone-small',
    stone: 'limestone',
    inscription: ['In loving memory', 'Keith Stephen', 'LAWLOR', '15-3-1935 - 19-11-2006', 'forever in our hearts']
  },
  {
    id: 'C33',
    section: 'C',
    col: 16,
    row: 3,
    kind: 'plaque-angled',
    stone: 'granite',
    inscription: [
      'In',
      'loving memory of',
      'Jane Melanie',
      'Mackinnon WYKES',
      'nee LUNNON',
      '1st September 1957',
      '20 January 2005',
      'dearly loved and remembered',
      'always by her family and those',
      'who shared her life'
    ]
  },
  {
    id: 'C34',
    section: 'C',
    col: 18,
    row: 3,
    kind: 'headstone',
    stone: 'granite',
    inscription: [
      'In',
      'loving memory of',
      'Conrad Charles Norman',
      'MACKINNON',
      'a dear husband, father',
      'and grandad',
      'died 14th November 1979',
      'aged 82 years',
      '',
      'And',
      'Janet Rose Lilian',
      'MACKINNON',
      'nee RICHARDSON',
      'a dear wife, mother',
      'and nana',
      'died 5th August 1995',
      'aged 93 years',
      '',
      'And Janet MACKINNON',
      'nee RICHARDSON'
    ]
  },
  {
    id: 'C35',
    section: 'C',
    col: 20,
    row: 3,
    kind: 'plaque',
    stone: 'limestone',
    inscription: ['In', 'remembrance', 'of', 'Sara Frances', 'RICHMOND', '1932 - 1993']
  },
  {
    id: 'C36',
    section: 'C',
    col: 22,
    row: 3,
    kind: 'plaque',
    stone: 'limestone',
    inscription: ['In loving memory of', 'John KELLY', '1916 - 2001']
  },
  {
    id: 'C37',
    section: 'C',
    col: 24,
    row: 3,
    kind: 'plaque',
    stone: 'granite',
    inscription: [
      'In memory of',
      'Patrick Joseph',
      'MULLAN',
      '1920 - 1999',
      'sadly missed',
      '',
      'Also',
      'Freda E. A. MULLAN',
      '1922 - 2006',
      'always in our thoughts'
    ]
  },
  {
    id: 'C38',
    section: 'C',
    col: 26,
    row: 3,
    kind: 'plaque',
    stone: 'limestone',
    inscription: ['In', 'loving memory', 'of', 'Aubrey William', 'HOWES', '1924 - 1993']
  },
  {
    id: 'C39',
    section: 'C',
    col: 28,
    row: 3,
    kind: 'plaque',
    stone: 'limestone',
    inscription: [
      'In loving memory',
      'of',
      'a dear mother and nan',
      'Lillie L HOWES',
      'died',
      '12th Dec 1980',
      'aged 81 years'
    ]
  },
  {
    id: 'C40',
    section: 'C',
    col: 30,
    row: 3,
    kind: 'plaque',
    stone: 'granite',
    inscription: ['C. H. MARDELL', 'M.B.E.', '1912 - 1988', 'remembered', 'with love and pride']
  },
  {
    id: 'C41',
    section: 'C',
    col: 32,
    row: 3,
    kind: 'plaque',
    stone: 'limestone',
    inscription: ['Terry RHODES', 'forever in our hearts', 'God bless']
  },
  {
    id: 'C42',
    section: 'C',
    col: 34,
    row: 3,
    kind: 'plaque',
    stone: 'limestone',
    inscription: ['In loving memory', 'of', 'Ernest A PROBYN', '9-12-1923 - 20-3-1999', 'at peace']
  },
  {
    id: 'C43',
    section: 'C',
    col: 36,
    row: 3,
    kind: 'plaque',
    stone: 'granite',
    inscription: ['Richard Dominic John', 'GOMME', '20 Sept 1975 - 13 Jan 1995', 'much loved', 'greatly missed']
  }
];

// Convert survey-plan (col, row) to 3D world (x, z) meters anchored to St Peter's Church footprint.
// Church walls: row 8 -> x=-7.70 (West gable), row 28 -> x=+9.70 (East gable)
//               col 29 -> z=+3.30 (South Nave wall), col 38 -> z=-3.30 (North Nave wall)
export function surveyGridToWorld(col, row) {
  const x = -7.7 + (row - 8) * 0.87;
  let z;
  if (col <= 29) {
    // South churchyard (Section C south of the church)
    z = 3.3 + (29 - col) * 0.72;
  } else if (col <= 38) {
    // Band aligned with the church width (e.g. C40-C43 west of the West gable)
    z = 3.3 - ((col - 29) / 9) * 6.6;
  } else {
    // North side of the churchyard (north of the East-West gravel path at z ≈ -6.2)
    z = -6.2 - (col - 40) * 0.78;
  }
  return { x, z };
}
