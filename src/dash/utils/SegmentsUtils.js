/**
 * The copyright in this software is being made available under the BSD License,
 * included below. This software may be subject to other third party and contributor
 * rights, including patent rights, and no such rights are granted under this license.
 *
 * Copyright (c) 2013, Dash Industry Forum.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification,
 * are permitted provided that the following conditions are met:
 *  * Redistributions of source code must retain the above copyright notice, this
 *  list of conditions and the following disclaimer.
 *  * Redistributions in binary form must reproduce the above copyright notice,
 *  this list of conditions and the following disclaimer in the documentation and/or
 *  other materials provided with the distribution.
 *  * Neither the name of Dash Industry Forum nor the names of its
 *  contributors may be used to endorse or promote products derived from this software
 *  without specific prior written permission.
 *
 *  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS AS IS AND ANY
 *  EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 *  WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.
 *  IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT,
 *  INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT
 *  NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 *  PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 *  WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 *  ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 *  POSSIBILITY OF SUCH DAMAGE.
 */

import Segment from './../vo/Segment';

function zeroPadToLength(numStr, minStrLength) {
    while (numStr.length < minStrLength) {
        numStr = '0' + numStr;
    }
    return numStr;
}

function getNumberForSegment(segment, segmentIndex) {
    return segment.representation.startNumber + segmentIndex;
}

export function unescapeDollarsInTemplate(url) {
    return url ? url.split('$$').join('$') : url;
}

export function replaceIDForTemplate(url, value) {
    if (value === null || url === null || url.indexOf('$RepresentationID$') === -1) { return url; }
    let v = value.toString();
    return url.split('$RepresentationID$').join(v);
}

export function replaceTokenForTemplate(url, token, value) {
    const formatTag = '%0';

    let startPos,
        endPos,
        formatTagPos,
        specifier,
        width,
        paddedValue;

    const tokenLen = token.length;
    const formatTagLen = formatTag.length;

    if (!url) {
        return url;
    }

    // keep looping round until all instances of <token> have been
    // replaced. once that has happened, startPos below will be -1
    // and the completed url will be returned.
    while (true) {

        // check if there is a valid $<token>...$ identifier
        // if not, return the url as is.
        startPos = url.indexOf('$' + token);
        if (startPos < 0) {
            return url;
        }

        // the next '$' must be the end of the identifier
        // if there isn't one, return the url as is.
        endPos = url.indexOf('$', startPos + tokenLen);
        if (endPos < 0) {
            return url;
        }

        // now see if there is an additional format tag suffixed to
        // the identifier within the enclosing '$' characters
        formatTagPos = url.indexOf(formatTag, startPos + tokenLen);
        if (formatTagPos > startPos && formatTagPos < endPos) {

            specifier = url.charAt(endPos - 1);
            width = parseInt(url.substring(formatTagPos + formatTagLen, endPos - 1), 10);

            // support the minimum specifiers required by IEEE 1003.1
            // (d, i , o, u, x, and X) for completeness
            switch (specifier) {
                // treat all int types as uint,
                // hence deliberate fallthrough
                case 'd':
                case 'i':
                case 'u':
                    paddedValue = zeroPadToLength(value.toString(), width);
                    break;
                case 'x':
                    paddedValue = zeroPadToLength(value.toString(16), width);
                    break;
                case 'X':
                    paddedValue = zeroPadToLength(value.toString(16), width).toUpperCase();
                    break;
                case 'o':
                    paddedValue = zeroPadToLength(value.toString(8), width);
                    break;
                default:
                    return url;
            }
        } else {
            paddedValue = value;
        }

        url = url.substring(0, startPos) + paddedValue + url.substring(endPos + 1);
    }
}

function getSegment(representation, duration, presentationStartTime, mediaStartTime, availabilityStartTime,
    timelineConverter, presentationEndTime, isDynamic, index) {
    let seg = new Segment();

    seg.representation = representation;
    seg.duration = duration;
    seg.presentationStartTime = presentationStartTime;
    seg.mediaStartTime = mediaStartTime;
    seg.availabilityStartTime = availabilityStartTime;
    seg.availabilityEndTime = timelineConverter.calcAvailabilityEndTimeFromPresentationTime(presentationEndTime, representation.adaptation.period.mpd, isDynamic);
    seg.wallStartTime = timelineConverter.calcWallTimeForSegment(seg, isDynamic);
    seg.replacementNumber = getNumberForSegment(seg, index);
    seg.availabilityIdx = index;

    return seg;
}

export function getIndexBasedSegment(timelineConverter, isDynamic, representation, index) {
    let duration,
        presentationStartTime,
        presentationEndTime;

    duration = representation.segmentDuration;

    /*
     * From spec - If neither @duration attribute nor SegmentTimeline element is present, then the Representation
     * shall contain exactly one Media Segment. The MPD start time is 0 and the MPD duration is obtained
     * in the same way as for the last Media Segment in the Representation.
     */
    if (isNaN(duration)) {
        duration = representation.adaptation.period.duration;
    }

    presentationStartTime = parseFloat((representation.adaptation.period.start + (index * duration)).toFixed(5));
    presentationEndTime = parseFloat((presentationStartTime + duration).toFixed(5));

    return getSegment(representation, duration, presentationStartTime,
                      timelineConverter.calcMediaTimeFromPresentationTime(presentationStartTime, representation),
                      timelineConverter.calcAvailabilityStartTimeFromPresentationTime(presentationStartTime, representation.adaptation.period.mpd, isDynamic),
                      timelineConverter, presentationEndTime, isDynamic, index);
}

export function getTimeBasedSegment(timelineConverter, isDynamic, representation, time, duration, fTimescale, url, range, index, tManifest) {
    const scaledTime = time / fTimescale;
    const scaledDuration = Math.min(duration / fTimescale, representation.adaptation.period.mpd.maxSegmentDuration);

    let presentationStartTime,
        presentationEndTime,
        seg;

    presentationStartTime = timelineConverter.calcPresentationTimeFromMediaTime(scaledTime, representation);
    presentationEndTime = presentationStartTime + scaledDuration;

    seg = getSegment(representation, scaledDuration, presentationStartTime,
                     scaledTime,
                     representation.adaptation.period.mpd.manifest.loadedTime,
                     timelineConverter, presentationEndTime, isDynamic, index);

    seg.replacementTime = tManifest ? tManifest : time;

    url = replaceTokenForTemplate(url, 'Number', seg.replacementNumber);
    url = replaceTokenForTemplate(url, 'Time', seg.replacementTime);
    seg.media = url;
    seg.mediaRange = range;

    return seg;
}

export function getSegmentByIndex(index, representation) {
    if (!representation || !representation.segments) return null;

    const ln = representation.segments.length;
    let seg,
        i;

    if (index < ln) {
        seg = representation.segments[index];
        if (seg && seg.availabilityIdx === index) {
            return seg;
        }
    }

    for (i = 0; i < ln; i++) {
        seg = representation.segments[i];

        if (seg && seg.availabilityIdx === index) {
            return seg;
        }
    }

    return null;
}

export function decideSegmentListRangeForTemplate(timelineConverter, isDynamic, representation, requestedTime, index, givenAvailabilityUpperLimit) {
    if (!representation) {
        return {start: NaN, end: NaN};
    }
    const duration = representation.segmentDuration;
    const minBufferTime = representation.adaptation.period.mpd.manifest.minBufferTime;
    const availabilityWindow = representation.segmentAvailabilityRange;
    let periodRelativeRange = {
        start: timelineConverter.calcPeriodRelativeTimeFromMpdRelativeTime(representation, availabilityWindow ? availabilityWindow.start : NaN),
        end: timelineConverter.calcPeriodRelativeTimeFromMpdRelativeTime(representation, availabilityWindow ? availabilityWindow.end : NaN)
    };
    const currentSegmentList = representation.segments;
    const availabilityLowerLimit = 2 * duration;
    const availabilityUpperLimit = givenAvailabilityUpperLimit || Math.max(2 * minBufferTime, 10 * duration);
    let originAvailabilityTime = NaN;
    let originSegment = null;

    let start,
        end,
        range;

    periodRelativeRange.start = Math.max(periodRelativeRange.start, 0);

    if (isDynamic && !timelineConverter.isTimeSyncCompleted()) {
        start = Math.floor(periodRelativeRange.start / duration);
        end = Math.floor(periodRelativeRange.end / duration);
        range = {start: start, end: end};
        return range;
    }

    // if segments exist we should try to find the latest buffered time, which is the presentation time of the
    // segment for the current index
    if (currentSegmentList && currentSegmentList.length > 0) {
        originSegment = getSegmentByIndex(index, representation);
        if (originSegment) {
            originAvailabilityTime = timelineConverter.calcPeriodRelativeTimeFromMpdRelativeTime(representation, originSegment.presentationStartTime);
        } else {
            originAvailabilityTime = index > 0 ? index * duration :
                timelineConverter.calcPeriodRelativeTimeFromMpdRelativeTime(representation, requestedTime);
        }

    } else {
        // If no segments exist, but index > 0, it means that we switch to the other representation, so
        // we should proceed from this time.
        // Otherwise we should start from the beginning for static mpds or from the end (live edge) for dynamic mpds
        originAvailabilityTime = index > 0 ? index * duration : isDynamic ? periodRelativeRange.end : periodRelativeRange.start;
    }

    // segment list should not be out of the availability window range
    start = Math.floor(Math.max(originAvailabilityTime - availabilityLowerLimit, periodRelativeRange.start) / duration);
    end = Math.floor(Math.min(start + availabilityUpperLimit / duration, periodRelativeRange.end / duration));

    range = {start: start, end: end};

    return range;
}
