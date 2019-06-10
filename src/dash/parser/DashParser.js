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
import FactoryMaker from '../../core/FactoryMaker';
import Debug from '../../core/Debug';
import ObjectIron from './objectiron';
import X2JS from '../../../externals/xml2json';
import StringMatcher from './matchers/StringMatcher';
import DurationMatcher from './matchers/DurationMatcher';
import DateTimeMatcher from './matchers/DateTimeMatcher';
import NumericMatcher from './matchers/NumericMatcher';
import RepresentationBaseValuesMap from './maps/RepresentationBaseValuesMap';
import SegmentValuesMap from './maps/SegmentValuesMap';

function DashParser() {

    const context = this.context;

    let instance,
        logger,
        matchers,
        converter,
        objectIron;

    function setup() {
        logger = Debug(context).getInstance().getLogger(instance);
        matchers = [
            new DurationMatcher(),
            new DateTimeMatcher(),
            new NumericMatcher(),
            new StringMatcher() // last in list to take precedence over NumericMatcher
        ];

        converter = new X2JS({
            escapeMode: false,
            attributePrefix: '',
            arrayAccessForm: 'property',
            emptyNodeForm: 'object',
            stripWhitespaces: false,
            enableToStringFunc: false,
            ignoreRoot: true,
            matchers: matchers
        });

        objectIron = ObjectIron(context).create({
            adaptationset: new RepresentationBaseValuesMap(),
            period: new SegmentValuesMap()
        });
    }

    function getMatchers() {
        return matchers;
    }

    function getIron() {
        return objectIron;
    }

    function parse(data) {
        let manifest;
        const startTime = window.performance.now();

        manifest = converter.xml_str2json(data);

        if (!manifest) {
            throw new Error('parsing the manifest failed');
        }

        const jsonTime = window.performance.now();
        objectIron.run(manifest);

        const ironedTime = window.performance.now();
        logger.info('Parsing complete: ( xml2json: ' + (jsonTime - startTime).toPrecision(3) + 'ms, objectiron: ' + (ironedTime - jsonTime).toPrecision(3) + 'ms, total: ' + ((ironedTime - startTime) / 1000).toPrecision(3) + 's)');

        return manifest;
    }

    function parseJSON(data) { //, baseUrl, xlinkController) { //DIFF1: TODO JSON Parser - object extension of the MPD-Parser? in 3.x.x the only arg is "data"?
        let manifest;
        const startTime = window.performance.now();

        if (manifest = data, !manifest) {
            throw new Error('parsing the manifest failed');
        }
        const jsonTime = window.performance.now();

        // cleaning up of the url still necessary? parse() above looks alot simpler than parse() in 1.5.1
        //if (!manifest.hasOwnProperty("BaseURL")) {
        //this.log("Setting baseURL: " + baseUrl);
        //    manifest.BaseURL = baseUrl;
        //} else {

        // Setting manifest's BaseURL to the first BaseURL
        manifest.BaseURL = manifest.BaseURL_asArray[0];

        if (manifest.BaseURL.toString().indexOf("www") === 0) {
            manifest.BaseURL = "http://" + manifest.BaseURL;
        }

        if (manifest.BaseURL.toString().slice(-1) !== "/") {
            manifest.BaseURL = manifest.BaseURL + "/";
        }

        //if (manifest.BaseURL.toString().indexOf("http") !== 0) { //is there a baseUrl defined somewhere?
        //    manifest.BaseURL = baseUrl + manifest.BaseURL;
        //}
        //}

        // already implemented in ManifestLoader.load()
        //if(manifest.hasOwnProperty("Location")){
        // for now, do not support multiple Locations -
        // just set Location to the first Location.
        //  manifest.Location = manifest.Location_asArray[0]
        //}
        //this.log("Flatten manifest properties.");
        objectIron.run(manifest);

        // also done in ManifestLoader.load()
        //xlinkController.setMatchers(matchers);
        //xlinkController.setIron(objectIron);


        const ironedTime = window.performance.now();
        logger.info('Parsing complete: ( xml2json: ' + (jsonTime - startTime).toPrecision(3) + 'ms, objectiron: ' + (ironedTime - jsonTime).toPrecision(3) + 'ms, total: ' + ((ironedTime - startTime) / 1000).toPrecision(3) + 's)');

        return manifest;
    }

    instance = {
        parse: parse,
        parseJSON: parseJSON, //DIFF2
        getMatchers: getMatchers,
        getIron: getIron
    };

    setup();

    return instance;
}

DashParser.__dashjs_factory_name = 'DashParser';
export default FactoryMaker.getClassFactory(DashParser);
