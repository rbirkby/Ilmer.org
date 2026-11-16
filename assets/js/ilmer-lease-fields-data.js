/* Field shapes traced from three estate lease plans: Lower Farm, Middle Farm
 * and Coldharbour Farm. The plans are undated manuscript sketches, not
 * surveys, so the shapes are schematic.
 *
 * Every point is a pixel position on the photograph of the plan it came
 * from. `planToMetres` turns a plan point into metres east/south of a common
 * origin by rotating the plan to north-up (using its compass), scaling it to
 * the acreage in its schedule, and shifting it into place beside the other
 * plans. The shifts are an interpretation; the plans share no surveyed
 * control points.
 *
 * Areas are in acres, roods and perches as written in each schedule.
 */

/** @typedef {[number, number]} Point */
/** @typedef {{ a: number, r: number, p: number }} Arp */
/**
 * @typedef {object} LeaseField
 * @property {string} no Field number on the plan
 * @property {string} [name] Name from the schedule
 * @property {Arp} [area] Area from the schedule
 * @property {string} [use] Use letter from the schedule: m meadow, p pasture, a arable
 * @property {Point[]} points Outline, in plan pixels
 * @property {string} [note] Uncertain readings or placements
 */
/**
 * @typedef {object} LeaseFarm
 * @property {string} id
 * @property {string} name
 * @property {string} color
 * @property {Point} compass Direction of the plan's north arrow, in plan pixels; null when the plan has none
 * @property {boolean} compassShown Whether the plan itself carries a north arrow
 * @property {number} metresPerPixel
 * @property {Point} anchor Plan pixel placed at `origin`
 * @property {Point} origin Metres east/south where `anchor` lands
 * @property {Arp} [total] Schedule total, as written
 * @property {string} [totalNote] Where the written total differs from the sum of the fields
 * @property {Point[][]} lanes Lanes and roads drawn on the plan, in plan pixels
 * @property {LeaseField[]} fields
 * @property {string} source
 */

const ACRE_M2 = 4046.8564224;

/** @param {Arp} arp */
export const arpToAcres = ({ a, r, p }) => a + r / 4 + p / 160;

/** @param {Arp} arp */
export const formatArp = ({ a, r, p }) => `${a}a ${r}r ${p}p`;

/** Shoelace area of a polygon, in the square of its units. @param {Point[]} pts */
export const polygonArea = (pts) => {
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
};

/** Area-weighted centroid, for placing labels. @param {Point[]} pts */
export const polygonCentroid = (pts) => {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    const f = x1 * y2 - x2 * y1;
    a += f;
    cx += (x1 + x2) * f;
    cy += (y1 + y2) * f;
  }
  return /** @type {Point} */ ([cx / (3 * a), cy / (3 * a)]);
};

/** Angle (radians) that turns the plan's north arrow to point up the screen. @param {LeaseFarm} farm */
export const northUpRotation = (farm) => -Math.PI / 2 - Math.atan2(farm.compass[1], farm.compass[0]);

/**
 * Plan pixel → metres east (x) and south (y) of the map origin.
 * @param {LeaseFarm} farm
 * @param {Point} pt
 * @returns {Point}
 */
export const planToMetres = (farm, [x, y]) => {
  const t = northUpRotation(farm);
  const dx = (x - farm.anchor[0]) * farm.metresPerPixel;
  const dy = (y - farm.anchor[1]) * farm.metresPerPixel;
  return [farm.origin[0] + dx * Math.cos(t) - dy * Math.sin(t), farm.origin[1] + dx * Math.sin(t) + dy * Math.cos(t)];
};

/**
 * Scale (metres per plan pixel) that makes the traced fields add up to their schedule acreage.
 * @param {LeaseField[]} fields
 */
export const scaleFromSchedule = (fields) => {
  const scheduled = fields.filter((f) => f.area);
  const px = scheduled.reduce((s, f) => s + polygonArea(f.points), 0);
  const m2 = scheduled.reduce((s, f) => s + arpToAcres(/** @type {Arp} */ (f.area)) * ACRE_M2, 0);
  return Math.sqrt(m2 / px);
};

/** @type {LeaseField[]} */
const LOWER_FIELDS = [
  {
    no: '11',
    name: 'Picked mead',
    area: { a: 6, r: 1, p: 0 },
    use: 'm',
    points: [
      [437, 35],
      [467, 105],
      [540, 275],
      [500, 257],
      [455, 237],
      [447, 220],
      [390, 132]
    ]
  },
  {
    no: '12',
    name: 'Long mead',
    area: { a: 9, r: 0, p: 0 },
    use: 'm',
    points: [
      [462, 2],
      [542, 135],
      [552, 135],
      [575, 217],
      [592, 202],
      [647, 317],
      [595, 325],
      [540, 275],
      [467, 105],
      [437, 35]
    ]
  },
  {
    no: '19',
    name: 'Cole harbour',
    area: { a: 9, r: 0, p: 8 },
    use: 'a',
    points: [
      [302, 340],
      [317, 318],
      [425, 320],
      [482, 402],
      [422, 462]
    ],
    note: 'The plan number could be read as 17; the schedule has 19.'
  },
  {
    no: '20',
    name: 'Little mead',
    area: { a: 1, r: 1, p: 12 },
    use: 'm',
    points: [],
    note: 'Listed in the schedule but not numbered on the plan, so it is not drawn.'
  },
  {
    no: '35',
    name: 'Old orchard',
    area: { a: 2, r: 0, p: 28 },
    use: 'p',
    points: [
      [130, 1042],
      [168, 1040],
      [172, 1090],
      [128, 1092]
    ]
  },
  {
    no: '44',
    name: 'House and yard',
    area: { a: 0, r: 1, p: 33 },
    points: [
      [190, 1290],
      [220, 1282],
      [232, 1325],
      [197, 1320]
    ],
    note: 'Not numbered legibly on the plan; placed on the farmstead plots beside the lane.'
  },
  {
    no: '45',
    name: 'Orchard',
    area: { a: 0, r: 1, p: 18 },
    use: 'p',
    points: [
      [195, 1250],
      [205, 1236],
      [217, 1235],
      [220, 1282],
      [190, 1290]
    ],
    note: 'Number partly hidden by the field boundary; position approximate.'
  },
  {
    no: '46',
    name: "Old Mary's",
    area: { a: 0, r: 3, p: 24 },
    use: 'p',
    points: [
      [217, 1235],
      [237, 1232],
      [250, 1272],
      [220, 1282]
    ]
  },
  {
    no: '47',
    name: 'Monks close',
    area: { a: 2, r: 1, p: 8 },
    use: 'p',
    points: [
      [207, 1185],
      [242, 1177],
      [277, 1259],
      [255, 1272],
      [250, 1272],
      [237, 1232],
      [205, 1236]
    ]
  },
  {
    no: '48',
    name: 'Old Joes close',
    area: { a: 2, r: 0, p: 20 },
    use: 'p',
    points: [
      [242, 1177],
      [282, 1157],
      [317, 1252],
      [277, 1259]
    ]
  },
  {
    no: '50',
    name: 'Hogs piece',
    area: { a: 8, r: 2, p: 14 },
    use: 'a',
    points: [
      [282, 1157],
      [407, 1100],
      [445, 1245],
      [320, 1260],
      [317, 1252]
    ]
  },
  {
    no: '51',
    name: 'Sheep ground',
    area: { a: 11, r: 3, p: 8 },
    use: 'p',
    points: [
      [407, 1100],
      [477, 1064],
      [547, 1289],
      [460, 1296],
      [445, 1245]
    ]
  },
  {
    no: '58',
    name: 'Old Joes',
    area: { a: 7, r: 1, p: 10 },
    use: 'a',
    points: [
      [460, 1296],
      [547, 1289],
      [585, 1427],
      [540, 1442],
      [482, 1424]
    ]
  },
  {
    no: '59',
    name: 'Middle close',
    area: { a: 10, r: 0, p: 2 },
    use: 'a',
    points: [
      [320, 1260],
      [445, 1245],
      [460, 1296],
      [482, 1424],
      [375, 1398],
      [332, 1403],
      [330, 1380]
    ]
  },
  {
    no: '60',
    name: 'Home close',
    area: { a: 6, r: 2, p: 0 },
    use: 'a',
    points: [
      [220, 1282],
      [250, 1272],
      [255, 1272],
      [277, 1259],
      [317, 1252],
      [320, 1260],
      [330, 1380],
      [292, 1381],
      [237, 1370],
      [232, 1325]
    ],
    note: 'The use letter could be p or a.'
  },
  {
    no: '61',
    name: 'Upper Plat',
    area: { a: 0, r: 3, p: 4 },
    use: 'p',
    points: [
      [197, 1320],
      [232, 1325],
      [237, 1370],
      [215, 1375]
    ],
    note: 'Not numbered legibly on the plan; taken to be the strip between Home close and the lane.'
  },
  {
    no: '62',
    name: 'Lower Plat',
    area: { a: 2, r: 0, p: 10 },
    use: 'p',
    points: [
      [215, 1375],
      [237, 1370],
      [292, 1381],
      [330, 1380],
      [332, 1403],
      [225, 1405]
    ]
  },
  {
    no: '63',
    name: 'Green Iliner Highway',
    area: { a: 6, r: 2, p: 12 },
    use: 'p',
    points: [
      [225, 1405],
      [332, 1403],
      [375, 1398],
      [482, 1424],
      [540, 1442],
      [585, 1427],
      [640, 1430],
      [690, 1475],
      [677, 1482],
      [630, 1472],
      [545, 1492],
      [475, 1475],
      [430, 1440],
      [330, 1420],
      [230, 1422]
    ],
    note: '"Iliner" is the spelling in the schedule; the tithe apportionment of 1839 has Green Illmire.'
  },
  {
    no: '64',
    name: 'Little meadow',
    area: { a: 1, r: 0, p: 8 },
    use: 'm',
    points: [
      [430, 1440],
      [475, 1475],
      [442, 1522],
      [412, 1485]
    ]
  },
  {
    no: '65',
    name: 'Great meadow',
    area: { a: 16, r: 2, p: 13 },
    use: 'm',
    points: [
      [475, 1475],
      [545, 1492],
      [630, 1472],
      [677, 1482],
      [567, 1557],
      [575, 1582],
      [307, 1737],
      [288, 1685],
      [455, 1600],
      [475, 1580],
      [442, 1522]
    ],
    note: 'Includes the long strip below Green Iliner, which is not numbered separately.'
  },
  {
    no: '66',
    name: 'Green Iliner',
    area: { a: 18, r: 1, p: 35 },
    use: 'm',
    points: [
      [230, 1422],
      [330, 1420],
      [430, 1440],
      [412, 1485],
      [442, 1522],
      [475, 1580],
      [455, 1600],
      [288, 1685],
      [262, 1580],
      [240, 1480]
    ]
  },
  {
    no: '',
    name: 'Open field land',
    area: { a: 3, r: 3, p: 19 },
    points: [],
    note: 'Strips in the common fields, not drawn on the plan.'
  }
];

/** @type {LeaseField[]} */
const MIDDLE_FIELDS = [
  {
    no: '8',
    points: [
      [305, 62],
      [325, 52],
      [425, 118],
      [398, 220],
      [385, 228],
      [355, 280],
      [312, 342],
      [307, 200]
    ]
  },
  {
    no: '9',
    points: [
      [440, 128],
      [515, 175],
      [413, 222],
      [425, 170]
    ]
  },
  {
    no: '24',
    points: [
      [240, 545],
      [280, 620],
      [270, 700],
      [287, 800],
      [282, 852],
      [225, 925],
      [200, 985],
      [150, 1035],
      [120, 1047],
      [132, 945],
      [102, 827],
      [75, 730],
      [72, 680],
      [100, 620],
      [165, 580]
    ]
  },
  {
    no: '28',
    points: [
      [300, 900],
      [507, 697],
      [550, 705],
      [495, 770],
      [350, 905],
      [320, 927]
    ]
  },
  {
    no: '29',
    points: [
      [430, 635],
      [795, 340],
      [910, 500],
      [765, 605],
      [737, 635],
      [727, 622],
      [700, 637],
      [550, 705],
      [515, 692],
      [470, 667]
    ]
  },
  {
    no: '30',
    points: [
      [550, 705],
      [700, 637],
      [727, 622],
      [737, 635],
      [765, 605],
      [910, 500],
      [995, 622],
      [800, 700],
      [797, 723],
      [700, 800],
      [727, 825],
      [657, 940],
      [495, 770]
    ]
  },
  {
    no: '31',
    points: [
      [350, 905],
      [495, 770],
      [657, 940],
      [525, 1090]
    ]
  },
  {
    no: '34',
    points: [
      [320, 927],
      [350, 905],
      [525, 1090],
      [637, 1185],
      [332, 1238],
      [325, 1205],
      [290, 1100],
      [207, 1030]
    ]
  },
  {
    no: '36',
    points: [
      [77, 1362],
      [160, 1367],
      [147, 1390],
      [110, 1387]
    ],
    note: 'Number faint; could be 35 or 36.'
  },
  {
    no: '37',
    points: [
      [75, 1305],
      [145, 1305],
      [147, 1352],
      [90, 1345]
    ]
  },
  {
    no: '42',
    points: [
      [137, 1470],
      [205, 1452],
      [222, 1470],
      [250, 1530],
      [242, 1570],
      [200, 1570],
      [170, 1550],
      [155, 1505]
    ],
    note: 'The farmstead, drawn with buildings. The number is hard to read and may not be 42.'
  },
  {
    no: '49',
    points: [
      [250, 1370],
      [290, 1342],
      [370, 1325],
      [425, 1340],
      [485, 1345],
      [550, 1315],
      [400, 1400],
      [350, 1425],
      [295, 1450],
      [265, 1440]
    ]
  },
  {
    no: '52',
    points: [
      [710, 1175],
      [740, 1250],
      [757, 1375],
      [740, 1450],
      [735, 1560],
      [712, 1592],
      [697, 1600],
      [670, 1510],
      [650, 1400],
      [640, 1340],
      [610, 1275]
    ]
  },
  {
    no: '54',
    points: [
      [1022, 1325],
      [1122, 1397],
      [1025, 1527],
      [975, 1495],
      [978, 1460],
      [977, 1410],
      [1000, 1370]
    ]
  },
  {
    no: '55',
    points: [
      [1122, 1397],
      [1222, 1452],
      [1200, 1500],
      [1125, 1595],
      [1087, 1642],
      [1070, 1637],
      [1005, 1690],
      [980, 1750],
      [935, 1785],
      [860, 1797],
      [905, 1745],
      [930, 1720],
      [1000, 1600],
      [1025, 1527]
    ]
  },
  {
    no: '56',
    points: [
      [712, 1592],
      [737, 1557],
      [775, 1552],
      [850, 1537],
      [950, 1525],
      [975, 1495],
      [1025, 1527],
      [1000, 1600],
      [930, 1720],
      [905, 1745]
    ]
  },
  {
    no: '57',
    points: [
      [697, 1600],
      [712, 1592],
      [905, 1745],
      [860, 1797],
      [843, 1797],
      [800, 1752],
      [735, 1750],
      [715, 1700],
      [700, 1640]
    ]
  }
];

/** @type {LeaseField[]} */
const COLDHARBOUR_FIELDS = [
  {
    no: '16',
    name: 'House &c',
    area: { a: 0, r: 2, p: 35 },
    points: [
      [637, 367],
      [750, 465],
      [700, 505],
      [637, 420]
    ]
  },
  {
    no: '10',
    name: 'Far Meadow',
    area: { a: 1, r: 2, p: 20 },
    points: [
      [490, 472],
      [570, 370],
      [620, 342],
      [642, 335],
      [637, 367],
      [637, 420],
      [580, 510]
    ]
  },
  {
    no: '14',
    name: 'Far Ground',
    area: { a: 6, r: 3, p: 30 },
    points: [
      [825, 22],
      [1015, 240],
      [1000, 250],
      [880, 345],
      [707, 185],
      [760, 100]
    ]
  },
  {
    no: '15',
    name: 'Home Ground',
    area: { a: 6, r: 1, p: 0 },
    points: [
      [707, 185],
      [880, 345],
      [840, 385],
      [750, 465],
      [637, 367],
      [640, 335],
      [665, 225]
    ]
  },
  {
    no: '18',
    name: 'Backside',
    area: { a: 0, r: 3, p: 26 },
    points: [
      [840, 385],
      [865, 415],
      [752, 520],
      [722, 490],
      [750, 465]
    ]
  }
];

const LOWER_SCALE = scaleFromSchedule(LOWER_FIELDS.filter((f) => f.points.length));

/** @type {LeaseFarm[]} */
export const LEASE_FARMS = [
  {
    id: 'lower',
    name: 'Lower Farm',
    color: '#c0504d',
    compass: [240, 340],
    compassShown: true,
    metresPerPixel: LOWER_SCALE,
    anchor: [205, 1100],
    origin: [0, 0],
    total: { a: 127, r: 2, p: 26 },
    totalNote: 'The fields in the schedule add up to 127a 2r 6p, 20 perches less than the total written on it.',
    lanes: [
      [
        [300, 1790],
        [262, 1580],
        [228, 1418],
        [200, 1300],
        [190, 1180],
        [205, 1100],
        [240, 800],
        [290, 380],
        [302, 330],
        [345, 230],
        [440, 0]
      ],
      [
        [80, 1095],
        [205, 1100]
      ]
    ],
    fields: LOWER_FIELDS,
    source: 'Lower Farm lease plan and schedule'
  },
  {
    id: 'middle',
    name: 'Middle Farm',
    color: '#4f81bd',
    compass: [485, -5],
    compassShown: true,
    // the Middle Farm schedule was not supplied: the plan's lanes are drawn
    // at the same width as Lower Farm's, so it is assumed to share its scale
    metresPerPixel: LOWER_SCALE,
    anchor: [225, 1350],
    origin: [-640, -160],
    lanes: [
      [
        [330, 30],
        [300, 120],
        [300, 500],
        [270, 530],
        [240, 545],
        [165, 580],
        [100, 620],
        [40, 700],
        [0, 760]
      ],
      [
        [185, 1050],
        [215, 1250],
        [225, 1350],
        [235, 1450],
        [255, 1590],
        [290, 1680]
      ],
      [
        [30, 1340],
        [225, 1350],
        [370, 1310],
        [450, 1305],
        [640, 1185]
      ],
      [
        [100, 1620],
        [240, 1585]
      ]
    ],
    fields: MIDDLE_FIELDS,
    source: 'Middle Farm lease plan (schedule not supplied)'
  },
  {
    id: 'coldharbour',
    name: 'Coldharbour Farm',
    color: '#9bbb59',
    // the plan has no north arrow: drawn as it lies on the page
    compass: [0, -1],
    compassShown: false,
    metresPerPixel: scaleFromSchedule(COLDHARBOUR_FIELDS),
    anchor: [700, 505],
    origin: [-800, 1150],
    total: { a: 16, r: 1, p: 33 },
    totalNote: 'The fields in the schedule add up to 16a 1r 31p, 2 perches less than the total written on it.',
    lanes: [
      [
        [440, 475],
        [500, 490],
        [580, 512],
        [620, 555]
      ],
      [
        [700, 505],
        [680, 590]
      ],
      [
        [700, 505],
        [780, 560]
      ]
    ],
    fields: COLDHARBOUR_FIELDS,
    source: 'Coldharbour Farm lease plan and schedule'
  }
];
