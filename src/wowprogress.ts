import * as cheerio from 'cheerio';
import {from, Observable} from 'rxjs';
import {log} from './main';

export class WowprogressResult {

    progress: any;
    neckLevel: number = 0;
    battleTag: string | null = null;
    comments: string | null = null;
    ilvl: number = 0;
    wowclass: string = '';
    specsPlaying: string | null = null;
    raidTimes: string | null = null;
    lfg: string | null = null;

    public toString(): string {
        let output = '';
        if (this.progress) {
            output += this.progress;
        }
        if (this.neckLevel) {
            output += this.neckLevel;
        }
        if (this.battleTag) {
            output += this.battleTag;
        }
        if (this.specsPlaying) {
            output += this.specsPlaying;
        }
        if (this.raidTimes) {
            output += this.raidTimes;
        }
        if (this.lfg) {
            output += this.lfg;
        }
        if (this.progress) {
            output += this.progress;
        }
        return output;
    }

}

function getIlvl(ilvl_text: string): number {
    const re = ilvl_text.match(/Item Level: ([\d.,]+)/);
    if (re) {
        return parseFloat(re[1])
    }
    return 0
}

function getText(text: string, format: RegExp): string | null {
    const re = text.match(format);
    if (re) {
        return re[1];
    }
    return null
}

export function fetchWowprogress(region: string, realm: string, name: string): Observable<WowprogressResult> {

    log.info(`https://www.wowprogress.com/character/${region}/${realm}/${name}`);
    const data$ = from(
        fetch(`https://www.wowprogress.com/character/${region}/${realm}/${name}`)
            .then(resp => resp.ok ? resp.text() : Promise.reject(`Error in player fetch: ${resp.statusText} ${resp.status}`))
    );

    return new Observable(obs => {
        data$.subscribe(
            body => {
                const $ = cheerio.load(body);
                const neckLevel = $('div.gearscore span[aria-label$="exp"]').text();
                const progressData = $('#tiers_details div#tier_340 table.rating tbody tr td:nth-child(1) span');
                const progress = {
                    // 'normal': progressData.filter((i, x) => $(x).text().endsWith('Normal')).length,
                    'heroic': progressData.filter((i, x) => $(x).text().endsWith('Heroic')).length,
                    'mythic': progressData.filter((i, x) => $(x).text().endsWith('Mythic')).length
                };

                const wowProgressResult = new WowprogressResult();

                wowProgressResult.specsPlaying = getText($('div.language:contains("Specs playing")').text(), /Specs playing: (.+)/);
                wowProgressResult.raidTimes = getText($('div.language:contains("Raids per week")').text(), /Raids per week: (.+)/);
                wowProgressResult.lfg = getText($('div.language:contains("Looking for guild")').text(), /Looking for guild: (.+)/);

                const battleTag = $('span.profileBattletag').text();
                const comments = $('div.charCommentary').text();

                const wowclass = $('div.primary div div i span').text();

                const ilvl = getIlvl($('div.gearscore:contains("Item Level")').text());

                wowProgressResult.neckLevel = parseInt(neckLevel);
                wowProgressResult.battleTag = battleTag;
                wowProgressResult.wowclass = wowclass;
                wowProgressResult.comments = comments;
                wowProgressResult.ilvl = ilvl;
                wowProgressResult.progress = progress;
                obs.next(wowProgressResult);
            },
            (err) => {
                obs.error(err);
            });
    });
}
