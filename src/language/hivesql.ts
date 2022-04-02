import Formatter from '../core/FormatterSelf';
import Tokenizer from '../core/Tokenizer';
import tokenTypes from '../core/tokenTypes';
import NoNewLineWords from '../words/NoNewLineWords';
import TopWords from '../words/TopLevelWords';
import NewlineWords from '../words/NewlineWords';
import reserved from '../words/reservedWords';

const reservedTopLevelWordsNoIndent = ['INTERSECT', 'INTERSECT ALL', 'MINUS'];

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

let tokenizer;
let reservedNoNewLineWords:string[] = NoNewLineWords.reservedNoNewLineWords;
let reservedTopLevelWords:string[] = TopWords.reservedTopLevelWords;
let reservedNewlineWords:string[] = NewlineWords.reservedNewlineWords;
let reservedWords:string[] = reserved.reservedWords;

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
