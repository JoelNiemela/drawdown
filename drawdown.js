/**
 * drawdown.js
 * (c) Adam Leggett
 */

function markdown(src) {
    function replace(rex, fn) {
        src = src.replace(rex, fn);
    }

    function element(tag, { attr, content }={}) {
        if (content == null) {
            return `<${tag} ${attr}/>`;
        } else {
            return `<${tag} ${attr}>${content}</${tag}>`;
        }
    }

    const rx_blockquote = /\n *&gt; *([^]*?)(?=(\n|$){2})/g;
    function blockquote(src) {
        return src.replace(rx_blockquote, (_all, content) => {
            return element('blockquote', { content: blockquote(highlight(content.replace(/^ *&gt; */gm, ''))) });
        });
    }

    const rx_list = /\n( *)(?:[*\-+]|((\d+)|([a-z])|[A-Z])[.)]) +([^]*?)(?=(\n|$){2})/g;
    function list(src) {
        return src.replace(rx_list, (_all, ind, ol, num, low, content) => {
            const rx_bullet = RegExp(`\n ?${ind}(?:(?:\\d+|[a-zA-Z])[.)]|[*\\-+]) +`, 'g');

            const entry = highlight(content.split(rx_bullet).map(list).map((li) => element('li', { content: li })).join(''));
            return '\n' + (ol
                ? element('ol', { attr: `start="${num ? ol : `${parseInt(ol, 36) - 9}" style="list-style-type:${low ? 'lower-alpha' : 'upper-alpha'}`}"`, content: entry })
                : element('ul', { content: entry }));
        });
    }

    function md_tag_rx(tag) {
        return RegExp.escape(`${tag[0]}`);
    }

    const md_tags = {
        '**': 'strong',
        '__': 'strong',
        '*': 'em',
        '_': 'em',
        '~~': 's',
        '~': 'sub',
        '^': 'sup',
        '--': 'small',
        '++': 'big',
    };
    const rx_highlight = RegExp(`(^|[^A-Za-z\\d\\\\])((${Object.keys(md_tags).map(md_tag_rx).join('|')})(\\3?))([^<]*?)\\2(?!\\3)(?=\\W|_|$)`, 'g');
    function highlight(src) {
        return src.replace(rx_highlight, (_all, _, p, _s, _e, content) => {
            return (p in md_tags)
                ? _ + element(md_tags[p], { content: highlight(content) })
                : _all;
        });
    }

    const rx_escape = /\\([\\\|`*_{}\[\]()#+\-~])/g;
    function unesc(str) {
        return str.replace(rx_escape, '$1');
    }

    let si = 0;
    const stash = [];
    function freeze(str) {
        stash[++si] = str;
        return '\uf8ff' + si + '\uf8ff';
    }

    src = '\n' + src + '\n';

    const rx_space = /\t|\r|\uf8ff/g;
    replace(rx_space, '  ');

    function xml_tag_rx([tag, {attr}]) {
        return `(${RegExp.escape(tag)}${attr.map((attr) => `( ${RegExp.escape(attr)}="[^"]*")?`).join('')})`
    }

    const xml_tags = {
        'font': { attr: ['family', 'size'] },
        'link': { attr: ['href'] },
    };
    const rx_xml = RegExp(`<(${Object.entries(xml_tags).map(xml_tag_rx).join('|')})>`, 'g');
    const rx_xml_close = RegExp(`</(${Object.keys(xml_tags).join('|')})>`, 'g');
    replace(rx_xml, freeze);
    replace(rx_xml_close, freeze);

    const rx_lt = /</g;
    const rx_gt = />/g;
    replace(rx_lt, '&lt;');
    replace(rx_gt, '&gt;');

    // blockquote
    src = blockquote(src);

    // horizontal rule
    const rx_hr = /^([*\-=_] *){3,}$/gm;
    replace(rx_hr, element('hr'));

    // list
    src = list(src);

    const rx_listjoin = /<\/(ol|ul)>\n\n<\1>/g;
    replace(rx_listjoin, '');

    // code
    const rx_code = /\n((```|~~~).*\n?([^]*?)\n?\2|((    .*?\n)+))/g;
    replace(rx_code, (_all, _p1, _p2, p3, p4) => freeze(element('pre', { content: element('code', { content: p3||p4.replace(/^    /gm, '') }) })));

    // inline code
    const rx_code_inline = /(`+)([^`].*?)\1/g;
    replace(rx_code_inline, (_all, _p1, p2) => freeze(element('code', { content: p2 })));

    // link or image
    const rx_link = /((!?)\[(.*?)\]\((.*?)( ".*")?\)|\\([\\`*_{}\[\]()#+\-.!~]))/g;
    replace(rx_link, (_all, _p1, p2, p3, p4, _p5, p6) => {
        return freeze(
            p4
                ? p2
                    ? element('img', { attr: `src="${p4}" alt="${p3}"` })
                    : element('a', { attr: `href="${p4}"`, content: unesc(highlight(p3)) })
                : p6
        );
    });

    // table
    const rx_table = /\n(( *\|.*?\| *\n)+)/g;
    const rx_thead = /^.*\n( *\|( *\:?-+\:?-+\:? *\|)* *\n|)/;
    const rx_row = /.*\n/g;
    const rx_cell = /\||(.*?[^\\])\|/g;
    replace(rx_table, (_all, table) => {
        const sep = table.match(rx_thead)[1];
        return '\n' + element('table', {
            content: table.replace(rx_row, (row, ri) => {
                return row == sep ? '' : element('tr', { content: row.replace(rx_cell, (_all, cell, ci) => {
                    return ci ? element(sep && !ri ? 'th' : 'td', { content: unesc(highlight(cell || '')) }) : ''
                })})
            })
        })
    });

    // heading
    const rx_heading = /(?=^|>|\n)([>\s]*?)(#{1,6}) (.*?)( #*)? *(?=\n|$)/g;
    replace(rx_heading, (_all, _, p1, p2) => _ + element('h' + p1.length, { content: unesc(highlight(p2)) }));

    // paragraph
    const rx_para = /(?=^|>|\n)\s*\n+([^<]+?)\n+\s*(?=\n|<|$)/g;
    replace(rx_para, (_all, content) => element('p', { content: unesc(highlight(content)) }));

    // stash
    const rx_stash = /\uf8ff(\d+)\uf8ff/g;
    replace(rx_stash, (_all, num) => stash[parseInt(num)]);

    return src.trim();
}
