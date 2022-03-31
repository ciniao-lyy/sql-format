import Formatter from '../core/FormatterSelf';
import Tokenizer from '../core/Tokenizer';
import tokenTypes from '../core/tokenTypes';

const reservedWords = [
  'between',
  'table',
  'distinct',
  'external',
  'exists',
  'serdeproperties',
  'inputformat',
  'comment',
  'by',
  'as',
  'parquet',
  'row',
  'format',
  'temporary',
  'function'
];

const reservedTopLevelWords = [
  'and',
  'add jar',
  'on',
  'lateral view',
  'alter column',
  'alter table',
  'values',
  'from',
  'group by',
  'having',
  'insert overwrite',
  'insert into',
  'insert',
  'limit',
  'order by',
  'select',
  'set',
  'where',
  'create',
  'stored',
  'outputformat',
  'location',
  'inputformat',
  'with',
  'grouping'
];

const reservedTopLevelWordsNoIndent = ['INTERSECT', 'INTERSECT ALL', 'MINUS'];

const reservedNewlineWords = [
  'cross join',
  'inner join',
  'full join',
  'left join',
  'left outer join',
  'or',
  'outer join',
  'right join',
  'right outer join',
  'join',
  'lateral view',
  'else',
  'when',
  'union all',
  'union'
];

const tokenOverride = (token, previousReservedToken) => {
  if (
    token.type === tokenTypes.reserved_top_level &&
    token.value === 'set' &&
    previousReservedToken.value === 'by'
  ) {
    token.type = tokenTypes.reserved;
    return token;
  }
};
const reservedNoNewLineWords=[
  'least',
  'greatest',
  'unix_timestamp',
  'to_unix_timestamp',
  'to_date',
  'if',
  'over',
  'coalesce',
  'from_unixtime',
  'lead',
  'lag',
  'date_format',
  'date_add',
  'date_sub',
  'explode',
  'json_tuple',
  'get_json_object',
  'nvl',
  'format_datetime',
  'concat',
  'collect_set',
  'collect_list',
  'partitioned',
  'in',
  'round',
  'cast',
  'ifnull',
  'add_months',
  'trunc',
  'sum',
  'count',
  'substr',
  'split',
  'replace',
  'regexp_replace',
  'regexp_extract',
  'lpad',
  'rpad',
  'max',
  'min',
  'length',
  'concat_ws',
  'stack',
  'str_to_map',
  'instr',
  'userinfodecypt',
  'userinfodecrypt',
  'datediff',
  'partition',
  'sequence',
  'percentile',
  'months_between'
];

let tokenizer;

export default class HQLFormatter {
    cfg;
  /**
   * @param {Object} cfg Different set of configurations
   */
  constructor(cfg) {
    this.cfg = cfg;
  }

  /**
   * Format the whitespace in a HQL string to make it easier to read
   *
   * @param {String} query The HQL string
   * @return {String} formatted string
   */
  format(query) {
    if (!tokenizer) {
      tokenizer = new Tokenizer({
        reservedWords,
        reservedTopLevelWords,
        reservedNewlineWords,
        reservedTopLevelWordsNoIndent,
        stringTypes: [`""`, "''", '``'],
        openParens: ['(', 'case'],
        closeParens: [')', 'end'],
        indexedPlaceholderTypes: ['?'],
        namedPlaceholderTypes: [':'],
        lineCommentTypes: ['--'],
        specialWordChars: ['_', '$', '#', '.', '@','/'],
        reservedNoNewLineWords
      });
    }
    return new Formatter(this.cfg, tokenizer, tokenOverride).format(query);
  }
}
