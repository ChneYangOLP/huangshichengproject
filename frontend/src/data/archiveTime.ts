import type { ArchiveData } from './types';

export interface ArchiveTime {
  ranges: [number, number][];
  note: string;
}
export const TIMELINE_MIN_YEAR = 1400;
export const TIMELINE_MAX_YEAR = new Date().getFullYear();
export const chronologySource = 'https://www.dpm.org.cn/court/lineages.html';
// Era first years follow the Palace Museum's chronology. Gregorian year ranges
// include the 1912 abdication year: https://www.dpm.org.cn/court/lineage/226255.html
const eraFirstYears = {
  嘉靖: 1522, 隆庆: 1567, 顺治: 1644, 康熙: 1662, 雍正: 1723,
  乾隆: 1736, 嘉庆: 1796, 道光: 1821, 咸丰: 1851, 同治: 1862,
  光绪: 1875, 宣统: 1909,
};
const year = (era: keyof typeof eraFirstYears, number: number) => eraFirstYears[era] + number - 1;
const single = (era: keyof typeof eraFirstYears, number: number): ArchiveTime => ({
  ranges: [[year(era, number), year(era, number)]], note: '按清单明确记载的年份匹配。',
});
const interval = (start: number, end: number, note = '按清单记载的年代区间匹配。'): ArchiveTime => ({
  ranges: [[start, end]], note,
});

// Match the original period text rather than an archive ID, so a workbook
// re-import cannot silently apply an old record's dates to a different archive.
const periods: Record<string, ArchiveTime> = {
  '明代（清入关前）': interval(1368, 1644, '清单仅明确朝代，按明代范围匹配。'),
  '明代（嘉靖四十一年重录，隆庆元年抄毕）': interval(year('嘉靖', 41), year('隆庆', 1)),
  '清代（太祖朝，后金时期）': interval(1616, 1626, '按清单记载的太祖后金时期匹配。'),
  '清代（顺治十二年编修，乾隆初重订）': {
    ...single('顺治', 12), note: '匹配明确的顺治十二年（1655）；“乾隆初”未明确起止年，暂不扩展。',
  },
  '清代（顺治九年编修）': single('顺治', 9),
  '清代（康熙十一年编修）': single('康熙', 11),
  '清代（雍正九年编修）': single('雍正', 9),
  '清代（雍正十三年开馆）': single('雍正', 13),
  '清代（嘉庆四年成书）': single('嘉庆', 4),
  '清代（嘉庆二十五年成书）': single('嘉庆', 25),
  '清代（道光三十年开馆，咸丰六年成）': interval(year('道光', 30), year('咸丰', 6)),
  '清代': interval(1644, 1912, '清单仅明确朝代，按清代范围匹配。'),
  '清代（宣统元年开馆）': single('宣统', 1),
  '清代（宣统朝）': interval(1909, 1912, '按清单记载的宣统朝范围匹配。'),
  '清代（康熙二十五年敕编）': single('康熙', 25),
  '清代（顺治敕编，康熙二十六年告成）': interval(year('顺治', 1), year('康熙', 26), '起点按顺治朝起年，终点按清单记载的告成年份匹配。'),
  '清代（康熙二十六年敕编）': single('康熙', 26),
  '清代（雍正九年敕编）': single('雍正', 9),
  '清代（乾隆五年敕编）': single('乾隆', 5),
  '清代（嘉庆十二年敕编）': single('嘉庆', 12),
  '清代（道光四年敕编）': single('道光', 4),
  '清代（咸丰六年敕编）': single('咸丰', 6),
  '清代（同治五年敕编）': single('同治', 5),
  '清代（光绪五年敕编）': single('光绪', 5),
  '清代（顺治—嘉庆十二年）': interval(year('顺治', 1), year('嘉庆', 12)),
  '清代（康熙至光绪五朝）': interval(year('康熙', 1), 1908),
  '清代（乾隆以后）': interval(year('乾隆', 1), 1912, '按乾隆起至清代结束的范围匹配。'),
};

export function getArchiveTime(period: string): ArchiveTime {
  return periods[period] ?? { ranges: [], note: '年代尚未换算，暂不参与时间高亮。' };
}
export const formatArchiveTime = (time: ArchiveTime) => time.ranges.length
  ? time.ranges.map(([start, end]) => start === end ? `${start} 年` : `${start}–${end} 年`).join('、')
  : '待补充';

export function matchesArchiveYear(archive: Pick<ArchiveData, 'period'>, selectedYear: number) {
  return Number.isInteger(selectedYear) && getArchiveTime(archive.period).ranges.some(
    ([start, end]) => selectedYear >= start && selectedYear <= end,
  );
}
