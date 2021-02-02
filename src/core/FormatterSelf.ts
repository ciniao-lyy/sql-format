import {includes, isLength} from 'lodash/index';
import tokenTypes from './tokenTypes';

import Indentation from './Indentation';
import InlineBlock from './InlineBlock';
import Params from './Params';

const trimSpacesEnd = str => str.replace(/[ \t]+$/u, '');
const trimSpacesStart = str => str.replace(/^[ \t]|[ \t]+$/u, '');

export default class Formatter {
  /**
   * @param {Object} cfg
   *  @param {String} cfg.language
   *  @param {String} cfg.indent
   *  @param {Bool} cfg.uppercase
   *  @param {Integer} cfg.linesBetweenQueries
   *  @param {Object} cfg.params
   * @param {Tokenizer} tokenizer
   */
  cfg;
  indentation;
  inlineBlock;
  params;
  tokenizer;
  tokenOverride;
  previousReservedWord;
  tokens;
  index;
  constructor(cfg, tokenizer, tokenOverride) {
    this.cfg = cfg || {};
    this.indentation = new Indentation(this.cfg.indent);
    this.inlineBlock = new InlineBlock();
    this.params = new Params(this.cfg.params);
    this.tokenizer = tokenizer;
    this.tokenOverride = tokenOverride;
    this.previousReservedWord = {};
    this.tokens = [];
    this.index = 0;
  }

  /**
   * Formats whitespace in a SQL string to make it easier to read.
   *
   * @param {String} query The SQL query string
   * @return {String} formatted query
   */
  format(query) {
    this.tokens = this.tokenizer.tokenize(query);
    const formattedQuery = this.getFormattedQueryFromTokens();

    return formattedQuery.trim();
  }

  getFormattedQueryFromTokens() {
    let formattedQuery = '';
    //增加
    let groupingFlag = false;
    let lastType = '';
    let commentFlag = false;
    let lastVaule = '';
    let noNewLineFlag = false;
    let noNewLineBlock = [];
    let whenCnt = 0;
    let createFlag = false;
    let createArray = []
    let createSubArray = []
    let i = 0
    let f1_max = 0
    let f2_max = 0
    this.tokens.forEach((token, index) => {
      this.index = index;
      // 关键字小写
      if (token.type !== tokenTypes.string && token.type !== tokenTypes.line_comment
        && token.type !== tokenTypes.block_comment) {
        token.value = token.value.toLowerCase()
      }
      // 记录建表语句
      if (token.value === 'create') {
        createFlag = true;
      } else if (token.value === ';') {
        createFlag = false;
      };
      // grouping
      if (groupingFlag && token.type !== tokenTypes.whitespace && token.value !== 'sets'
      && ((token.value !== '(' && this.indentation.blockTypes.length === 0)
          || this.indentation.blockTypes.length !== 0)
      ){
        if (this.indentation.blockTypes.length === 0){
          groupingFlag = false;
          noNewLineFlag = false;
        } else {
          noNewLineFlag = true
        }
        if (token.value === '(') {
          token.value = '        ' + this.indentation.getBlockIndent() + token.value
        }
      }
      if (token.value === 'grouping') groupingFlag = true;
      // 后续内容不换行单词记录
      if (lastType === tokenTypes.reserved_no_new_line_words && !createFlag) {
        noNewLineFlag = true;
      }
      // top-level后不换行
      if (token.type !== tokenTypes.whitespace) {
        lastType = token.type
      };
      // comment后，换行
      if (commentFlag && token.type !== tokenTypes.whitespace) {
        if (!token.value.includes('\n') || token.type === tokenTypes.line_comment) formattedQuery += '\n        ' + this.indentation.getBlockIndent();
        // if (token.type === tokenTypes.line_comment) formattedQuery += '\n        ' + this.indentation.getBlockIndent()
        commentFlag = false;
      }
      // comment后特殊处理
      if (token.type === tokenTypes.line_comment || token.type === tokenTypes.block_comment) commentFlag=true;
      // 第一个when不换行
      if (token.value.toLowerCase() === 'when' || whenCnt === 1) {
        whenCnt++;
      } else if(token.value.toLowerCase() === 'end' || token.value.toLowerCase() === 'else') {
        whenCnt = 0
      };

      if (this.tokenOverride) token = this.tokenOverride(token, this.previousReservedWord) || token;


      // 跳过不可见字符操作
      if (token.type === tokenTypes.whitespace) {
        // 记录上次的不可见字符
        lastVaule = token.value
        // ignore (we do our own whitespace formatting)
      // 建表语句阶段
      } else if (createFlag) {
        if (token.value.includes('access_type')) {
          console.log('')
        }
        token.value = token.value.replace('`','').replace('`','')
        // 判断是否括号
        if (token.type === tokenTypes.open_paren) {
          this.indentation.increaseBlockLevel()
        } else if (token.type === tokenTypes.close_paren){
          this.indentation.decreaseBlockLevel()
          // 跳出字段循环之后
          if (this.indentation.blockTypes.length === 0) {
            // 最后个属性
            if (createSubArray.length === 2){
              createSubArray.push('comment')
              createSubArray.push("''")
            }
            createArray.push(createSubArray)
            createSubArray = []
            // 判断最大长度
            createArray.forEach(function (createSubArray) {
              f1_max = f1_max>createSubArray[0].length?f1_max: createSubArray[0].length
              f2_max = f2_max>createSubArray[1].length?f2_max: createSubArray[1].length
            });
            //补足空格
            // createArray.map(sub=>sub.map(arr=>[arr[0].padEnd(f1_max,' '),arr[1].padEnd(f2_max,' '),arr[2],arr[3]].join("\n")
            // createArray = createArray.map(sub=>sub.join("  "));
            createArray = createArray.map(sub=>(['  '+sub[0].padEnd(f1_max,' '),sub[1].padEnd(f2_max,' '),sub[2],sub[3]]).join("  "));

            // 格式化处理
            formattedQuery += '\n(\n' + createArray.join("\n")
            f1_max = 0
            f2_max = 0
            createArray = []
          }
        };
        // 非字段阶段处理
        if (this.indentation.blockTypes.length === 0) {
          
          if (token.type === tokenTypes.close_paren ||
             token.value === 'comment' ||
             token.value === 'partitioned' ||
             token.value === 'stored' ||
             token.value ===  'with' ||
             token.value ===  'row' ||
             token.value ===  'outputformat' ||
             token.value ===  'location') {
              formattedQuery += '\n'
          }
          if (token.value === '$' ||
          token.value === '{' ||
          token.value === '}' ||
          token.value === '.'){
            formattedQuery = (token.value === '$')?formattedQuery+token.value:trimSpacesStart(trimSpacesStart(formattedQuery))+token.value
          } else if (token.value === 'create'){
            formattedQuery = trimSpacesEnd(formattedQuery) + ((formattedQuery==='')?'':'\n\n') + token.value + ' '
          } else {
            formattedQuery += token.value + ' '
          }
        // 字段阶段
        } else if (this.indentation.blockTypes.length === 1){
          if (!token.value.includes('\n,')) {
            if (token.value !== '(' && token.value !== ')') {
              createSubArray.push(token.value)
            } else if (token.value === ')') {
              createSubArray[createSubArray.length-1] += token.value.replace('\n','')
            }
          } else {
            // 当前字段结尾
            if (createSubArray.length === 2){
              createSubArray.push('comment')
              createSubArray.push('')
            }
            createArray.push(createSubArray)
            createSubArray=[token.value.replace('\n','')]
          }
        // 字段包含括号
        } else if (this.indentation.blockTypes.length === 2){
          createSubArray[createSubArray.length-1] += token.value.replace('\n','')
        }
      // 注释处理
      } else if (token.type === tokenTypes.line_comment) {
        token.value = trimSpacesStart(trimSpacesEnd(token.value.replace('\n','')))
        if (lastVaule.includes('\n')) {
          token.value = '\n       '+this.indentation.getBlockIndent()+token.value
        }
        formattedQuery += token.value
        // formattedQuery = this.formatLineComment(token, formattedQuery);
      } else if (token.type === tokenTypes.block_comment) {
        formattedQuery = this.formatBlockComment(token, formattedQuery);
      } else if (token.type === tokenTypes.reserved_top_level) {
        // 不换行flag
        if (noNewLineFlag) {
          formattedQuery += token.value + ' '
        } else {
          // token切分，group by➡️group  by等
          let arrayToken = token.value.split(' ')
          token.value = arrayToken[0].padStart(6,' ') + '  '
          if (arrayToken.length > 1) {
            token.value += arrayToken.slice(1,).join("")+'  '
          }
          if (token.value.includes('insert')){
            formattedQuery += '\n\n'
          }
          formattedQuery = this.formatTopLevelReservedWord(token, formattedQuery);
          this.previousReservedWord = token;
        }
      } else if (token.type === tokenTypes.reserved_top_level_no_indent) {
        formattedQuery = this.formatTopLevelReservedWordNoIndent(token, formattedQuery);
        this.previousReservedWord = token;
      } else if (token.type === tokenTypes.reserved_newline) {
        if (token.value !== 'end' && token.value !== 'else' && token.value !== 'when') {
          let arrayToken = token.value.split(' ')
          if (this.indentation.blockTypes.length > 0) {
            arrayToken[0] = arrayToken[0].padStart(6,' ')
          }
          token.value = arrayToken[0].padStart(6,' ') + '  '
          if (arrayToken.length > 1) {
            token.value += arrayToken.slice(1,).join("")+'  '
          }
        }

        if (noNewLineFlag) {
          formattedQuery += token.value + ' ';
        } else if (whenCnt === 1) {
          formattedQuery += token.value+' ';
        } else {
          formattedQuery = this.formatNewlineReservedWord(token, formattedQuery);
        }
        this.previousReservedWord = token;
      } else if (token.type === tokenTypes.reserved) {
        if (noNewLineFlag) {
          token.value = token.value.replace('\n','')
        }
        formattedQuery = this.formatWithSpaces(token, formattedQuery);
        this.previousReservedWord = token;
      } else if (token.type === tokenTypes.open_paren) {
        if (noNewLineFlag) {
          noNewLineBlock.push('a')
          if (token.value.includes('case')) {
            formattedQuery += token.value.replace('\n,','\n       '+this.indentation.getBlockIndent()+',') + ' '
          } else {
            formattedQuery = trimSpacesEnd(formattedQuery) + token.value.replace('\n,','\n       '+this.indentation.getBlockIndent()+',')
          }
        } else {
          formattedQuery = this.formatOpeningParentheses(token, formattedQuery);
        }
      } else if (token.type === tokenTypes.close_paren) {
        if (noNewLineBlock.length > 0) {
          if (token.value.includes('end')) {
            formattedQuery += token.value + ' '
          } else {
            formattedQuery = trimSpacesEnd(formattedQuery) + token.value + ' '
          }
        } else {
          formattedQuery = this.formatClosingParentheses(token, formattedQuery);
        };
        if (noNewLineFlag){
          noNewLineBlock.pop()
        };
        if (noNewLineBlock.length === 0){
          noNewLineFlag = false
        };

      } else if (token.type === tokenTypes.placeholder) {
        formattedQuery = this.formatPlaceholder(token, formattedQuery);
      // } else if (token.type === tokenTypes.reserved_newline) {
        // noNewLineFlag = true
        // token.value = token.value.replace('\n','')

      }else if (token.value === ',') {
        formattedQuery = this.formatComma(token, formattedQuery);
      } else if (token.value === ':') {
        formattedQuery = this.formatWithSpaceAfter(token, formattedQuery);
      } else if (token.value === '.') {
        formattedQuery = this.formatWithoutSpaces(token, formattedQuery);
      } else if (token.value === ';') {
        formattedQuery = this.formatQuerySeparator(token, formattedQuery);
      } else {
        // top关键字之后数据,与不换行单词之后
        if (lastType === tokenTypes.reserved_top_level || noNewLineFlag){
          token.value = token.value.replace('\n','')
        // } else if (lastComment !== '' && !token.value.includes('\n') ) {
        //   token.value += '\n       '+this.indentation.getBlockIndent()
        //   lastComment = ''
        } else {
          token.value = token.value.replace('\n','\n       '+this.indentation.getBlockIndent())
        }
        // 特殊字符
        if (token.value === '$' ||
          token.value === '{' ||
          token.value === '}' ||
          token.value === '.'){
            formattedQuery = (token.value === '$')?formattedQuery + token.value:trimSpacesStart(trimSpacesStart(formattedQuery)) + token.value
          } else {
            formattedQuery = this.formatWithSpaces(token, formattedQuery)
          };
      }
    });
    return formattedQuery;
  }

  formatLineComment(token, query) {
    // query = trimSpacesEnd(query);
    // return query + token.value.replace('\n','');
    // return this.addNewline(query + token.value);
  }

  formatBlockComment(token, query) {
    query = trimSpacesEnd(query);
    return query + '  '+ token.value;
    // return this.addNewline(this.addNewline(query) + this.indentComment(token.value));
  }

  indentComment(comment) {
    return comment.replace(/\n[ \t]*/gu, '\n' + this.indentation.getIndent() + ' ');
  }

  formatTopLevelReservedWordNoIndent(token, query) {
    this.indentation.decreaseTopLevel();
    query = this.addNewline(query) + this.equalizeWhitespace(this.formatReservedWord(token.value));
    return this.addNewline(query);
  }

  formatTopLevelReservedWord(token, query) {
    this.indentation.decreaseTopLevel();

    if (this.indentation.blockTypes.length > 0) {
      query = this.addBlockNewline(query);
    } else {
      query = this.addNewline(query);
    }

    this.indentation.increaseTopLevel();

    // 修改
    // query += this.equalizeWhitespace(this.formatReservedWord(token.value));
    query += this.formatReservedWord(token.value);
    return query;
    // return this.addNewline(query);
  }

  formatNewlineReservedWord(token, query) {
    if (this.indentation.blockTypes.length > 0) {
      query = this.addBlockNewline(query)
    } else{
      query = trimSpacesEnd(query);
      if (!query.endsWith('\n')) query += '\n';
      // query = this.addNewline(query)
    };
    if (token.value.toLowerCase() === 'when' || token.value.toLowerCase() === 'else') {
      return query + '    ' + this.formatReservedWord(token.value) +' '
    }
    return query+  this.formatReservedWord(token.value)
    // return query+  this.equalizeWhitespace(this.formatReservedWord(token.value)) + ' '
  }

  // Replace any sequence of whitespace characters with single space
  equalizeWhitespace(string) {
    return string.replace(/\s+/gu, ' ');
  }

  // Opening parentheses increase the block indent level and start a new line
  formatOpeningParentheses(token, query) {
    // Take out the preceding space unless there was whitespace there in the original query
    // or another opening parens or line comment
    const preserveWhitespaceFor = [
      tokenTypes.whitespace,
      tokenTypes.open_paren,
      tokenTypes.line_comment
    ];
    if (!includes(preserveWhitespaceFor, this.previousToken().type)) {
      query = trimSpacesEnd(query);
    }
    // 补足缩进
    // 默认缩进
    token.value = token.value.replace('\n,','\n       '+this.indentation.getBlockIndent()+',')

    let caseFlag = token.value
    query += token.value;

    this.inlineBlock.beginIfPossible(this.tokens, this.index);

    if (!this.inlineBlock.isActive()) {
      this.indentation.increaseBlockLevel();
      if (!caseFlag.toLowerCase().includes('case')) {
        query = this.addBlockNewline(query);
      } else {
        query += ' '
      }
    }
    return query;
  }

  // Closing parentheses decrease the block indent level
  formatClosingParentheses(token, query) {
    token.value = token.value;
    if (this.inlineBlock.isActive()) {
      this.inlineBlock.end();
      return this.formatWithSpaceAfter(token, query);
    } else {
      query = this.formatWithSpaces(token, this.addBlockNewline(query));
      this.indentation.decreaseBlockLevel();
      return query;
      // if  (this.indentation.blockTypes.length > 0) {
      //   return this.formatWithSpaces(token, this.addBlockNewline(query));
      // } else {
      //   return this.formatWithSpaces(token, this.addNewline(query));
      // }
    }
  }

  formatPlaceholder(token, query) {
    return query + this.params.get(token) + ' ';
  }

  // Commas start a new line (unless within inline parentheses or SQL "LIMIT" clause)
  formatComma(token, query) {
    if (this.inlineBlock.isActive()) {
      return query;
    } else if (/^LIMIT$/iu.test(this.previousReservedWord.value)) {
      return query;
    } else {
      query = this.addNewline(query);
    }
    return trimSpacesEnd(query) + token.value;

  }

  formatWithSpaceAfter(token, query) {
    return trimSpacesEnd(query) + token.value + ' ';
  }

  formatWithoutSpaces(token, query) {
    return trimSpacesEnd(query) + token.value;
  }

  formatWithSpaces(token, query) {
    const value = token.type === 'reserved' ? this.formatReservedWord(token.value) : token.value;
    return query + value + ' ';
  }

  formatReservedWord(value) {
    return value;
  }

  formatQuerySeparator(token, query) {
    this.indentation.resetIndentation();
    return trimSpacesEnd(query) + '\n' + token.value + '\n'.repeat(this.cfg.linesBetweenQueries || 1);
  }

  // create table fileds
  formatCreateTableFiled(token) {
    // （），修改锁进级别

    return 'query';
  }

  addNewline(query) {
    query = trimSpacesEnd(query);
    if (!query.endsWith('\n')) query += '\n';
    return query + this.indentation.getIndent();
  }

  addBlockNewline(query) {
    query = trimSpacesEnd(query);
    if (!query.endsWith('\n')) query += '\n';
    return query + this.indentation.getBlockIndent();
  }

  previousToken(offset = 1) {
    return this.tokens[this.index - offset] || {};
  }
}
