/**
 * drawdown.js
 * (c) Adam Leggett
 */

function markdown(src) {
    const rx_lt = /</g;
    const rx_gt = />/g;
    const rx_space = /\t|\r|\uf8ff/g;
    const rx_escape = /\\([\\\|`*_{}\[\]()#+\-~])/g;
    const rx_hr = /^([*\-=_] *){3,}$/gm;
    const rx_blockquote = /\n *&gt; *([^]*?)(?=(\n|$){2})/g;
    const rx_list = /\n( *)(?:[*\-+]|((\d+)|([a-z])|[A-Z])[.)]) +([^]*?)(?=(\n|$){2})/g;
    const rx_listjoin = /<\/(ol|ul)>\n\n<\1>/g;
    const rx_highlight = /(^|[^A-Za-z\d\\])(([*_])|(~)|(\^)|(--)|(\+\+)|`)(\2?)([^<]*?)\2\8(?!\2)(?=\W|_|$)/g;
    const rx_code_inline = /(`+)([^`].*?)\1/g;
    const rx_code = /\n((```|~~~).*\n?([^]*?)\n?\2|((    .*?\n)+))/g;
    const rx_link = /((!?)\[(.*?)\]\((.*?)( ".*")?\)|\\([\\`*_{}\[\]()#+\-.!~]))/g;
    const rx_table = /\n(( *\|.*?\| *\n)+)/g;
    const rx_thead = /^.*\n( *\|( *\:?-+\:?-+\:? *\|)* *\n|)/;
    const rx_row = /.*\n/g;
    const rx_cell = /\||(.*?[^\\])\|/g;
    const rx_heading = /(?=^|>|\n)([>\s]*?)(#{1,6}) (.*?)( #*)? *(?=\n|$)/g;
    const rx_para = /(?=^|>|\n)\s*\n+([^<]+?)\n+\s*(?=\n|<|$)/g;
    const rx_stash = /-\d+\uf8ff/g;

    function replace(rex, fn) {
        src = src.replace(rex, fn);
    }

    function element(tag, content) {
        return `<${tag}>${content}</${tag}>`;
    }

    function blockquote(src) {
        return src.replace(rx_blockquote, (_all, content) => {
            return element('blockquote', blockquote(highlight(content.replace(/^ *&gt; */gm, ''))));
        });
    }

    function list(src) {
        return src.replace(rx_list, (_all, ind, ol, num, low, content) => {
            const entry = element('li', highlight(content.split(
                RegExp(`\n ?${ind}(?:(?:\\d+|[a-zA-Z])[.)]|[*\\-+]) +`, 'g')).map(list).join('</li><li>')));

            return '\n' + (ol
                ? '<ol start="' + (num
                    ? ol + '">'
                    : parseInt(ol, 36) - 9 + '" style="list-style-type:' + (low ? 'low' : 'upp') + 'er-alpha">') + entry + '</ol>'
                : element('ul', entry));
        });
    }

    function highlight(src) {
        return src.replace(rx_highlight, (_all, _, _p1, emp, sub, sup, small, big, p2, content) => {
            return _ + element(
                  emp ? (p2 ? 'strong' : 'em')
                : sub ? (p2 ? 's' : 'sub')
                : sup ? 'sup'
                : small ? 'small'
                : big ? 'big'
                : 'code',
                highlight(content));
        });
    }

    function unesc(str) {
        return str.replace(rx_escape, '$1');
    }

    const stash = [];
    let si = 0;

    function freeze(str) {
        stash[--si] = str;
        return si + '\uf8ff';
    }

    src = '\n' + src + '\n';

    replace(rx_lt, '&lt;');
    replace(rx_gt, '&gt;');
    replace(rx_space, '  ');

    // blockquote
    src = blockquote(src);

    // horizontal rule
    replace(rx_hr, '<hr/>');

    // list
    src = list(src);
    replace(rx_listjoin, '');

    // code
    replace(rx_code, (_all, _p1, _p2, p3, p4) => freeze(element('pre', element('code', p3||p4.replace(/^    /gm, '')))));

    // inline code
    replace(rx_code_inline, (_all, _p1, p2) => freeze(element('code', p2)));

    // link or image
    replace(rx_link, (_all, _p1, p2, p3, p4, _p5, p6) => {
        return freeze(
            p4
                ? p2
                    ? `<img src="${p4}" alt="${p3}"/>`
                    : `<a href="${p4}">${unesc(highlight(p3))}</a>`
                : p6
        );
    });

    // table
    replace(rx_table, (_all, table) => {
        const sep = table.match(rx_thead)[1];
        return '\n' + element('table',
            table.replace(rx_row, (row, ri) => {
                return row == sep ? '' : element('tr', row.replace(rx_cell, (_all, cell, ci) => {
                    return ci ? element(sep && !ri ? 'th' : 'td', unesc(highlight(cell || ''))) : ''
                }))
            })
        )
    });

    // heading
    replace(rx_heading, (_all, _, p1, p2) => { return _ + element('h' + p1.length, unesc(highlight(p2))) });

    // paragraph
    replace(rx_para, (_all, content) => { return element('p', unesc(highlight(content))) });

    // stash
    replace(rx_stash, (all) => { return stash[parseInt(all)] });

    return src.trim();
};
