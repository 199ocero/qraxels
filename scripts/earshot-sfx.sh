#!/bin/sh
# Re-renders public/sfx/ from earshot's sound bank (https://github.com/Leonxlnx/earshot, MIT; pure DSP, deterministic per id).
# Needs earshot installed (`earshot --help` works). Peak times used for sync live in remotion/mono.ts (PEAK).
# The palette copies the reference edits: soft pops when things appear, a deep sub on big moments, one riser into the drop.
set -e
cd "$(dirname "$0")/../public/sfx"
r() { earshot sfx render "$1" -o "$2"; }
r pop/0 pop.wav # pro_pop/bloop ranks higher but its pitch climbs (earshot check: "reads as cheap")
r notify/m5 ding.wav
r sub_drop/long sub.wav
r riser/build riser.wav
r whoosh_fast/whip whoosh.wav
r cut_hit/punch punch.wav
r pro_impact/short land.wav
r fit/tick/domino tick.wav
r cut_hit/kick kick.wav
# The label-only pictures (remotion/mono.ts BEATS):
r pro_impact/deep impact.wav
r pro_shimmer/m1 shimmer.wav # pro_shimmer/m3 rings metallic (earshot check)
r logo_sting/spark sting.wav
r fit/bell/small_bell bell.wav
r swish/blade swish.wav
r whoosh_big/jet jet.wav
r shutter/dslr shutter.wav
r knock/wood knock.wav
r drip/drop drip.wav
r downlifter/sub_sink sink.wav
r glitch/hit buzz.wav
r whoosh_fast/tight zip.wav # pro_zip/up's rising glide reads as cheap (earshot check)
r swipe/paper page.wav
earshot sfx check ./*.wav
