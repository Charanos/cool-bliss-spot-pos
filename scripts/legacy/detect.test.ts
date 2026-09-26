import { describe, expect, it } from 'vitest';
import { cssProblems, jsProblems } from './detect.mjs';

describe('what Safari 15.4 cannot read (docs/11 D-24)', () => {
  it('finds syntax newer than the iPad mini 4', () => {
    expect(jsProblems('class A{static{this.x=1}}')).toEqual(['class static block (Safari 16.4)']);
    expect(jsProblems('var r=/(?<=a)b/;')).toEqual(['regex lookbehind (Safari 16.4)']);
    expect(jsProblems('var s=[3,1].toSorted();')).toHaveLength(1);
    expect(jsProblems('class A{#x=1;static y=2;m(o){return #x in o}}; var z=a??=1;')).toEqual([]);
  });

  it('finds unguarded CSS it cannot read, and ignores what sits behind @supports', () => {
    expect(cssProblems('a{color:color-mix(in oklab,red 5%,transparent)}')).toEqual(['color-mix() (Safari 16.2)']);
    expect(cssProblems('@supports (color:color-mix(in lab,red,red)){a{color:color-mix(in oklab,red,blue)}}')).toEqual([]);
    expect(cssProblems('@container (min-width:1px){a{b:c}}')).toEqual(['container queries (Safari 16)']);
    expect(cssProblems('.\\@container{container-type:inline-size}')).toEqual([]);
    expect(cssProblems('a{backdrop-filter:blur(2px)}')).toEqual(['backdrop-filter without -webkit- (1)']);
    expect(cssProblems('a{-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px)}')).toEqual([]);
  });
});
