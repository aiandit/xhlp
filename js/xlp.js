// see http://stackoverflow.com/questions/5722410/how-can-i-use-javascript-to-transform-xml-xslt
// see http://www.w3schools.com/xsl/xsl_client.asp

var xlp = xlp || {}

xlp.base = '/static/'

xlp.scopy = ({...str}) => { return {...str} }
xlp.dcopy = (o) => JSON.parse(JSON.stringify(o))

//https://stackoverflow.com/questions/3362471/how-can-i-call-a-javascript-constructor-using-call-or-apply
function callConstructor(constructor) {
    var factoryFunction = constructor.bind.apply(constructor, arguments);
    return new factoryFunction();
}
// var d = callConstructor(Date, 2008, 10, 8, 00, 16, 34, 254);
// var dateFactory = callConstructor.bind(null, Date)
// var d = dateFactory(2008, 10, 8, 00, 16, 34, 254);

// let unwrap2 = function({a, c}) { return { a, c }; };

xlp.sobj = function(obj, sel) {
    var res = {}
    sel.forEach(function(k) { res[k] = obj[k] })
    return res
}

xlp.mobjs = function(obj1, obj2) {
    return Object.assign({}, obj1, obj2)
}

xlp.hasActiveXSupport = function () {
    return (Object.getOwnPropertyDescriptor && Object.getOwnPropertyDescriptor(window, "ActiveXObject"))
        || ("ActiveXObject" in window)
}

xlp.isIE = xlp.hasActiveXSupport()
xlp.isWebKit = !(typeof document.webkitVisibilityState == "undefined")
xlp.isKonq = xlp.isWebKit && (typeof document.webkitFullscreenEnabled == "undefined")
xlp.isChrome = !(typeof document.webkitFullscreenEnabled == "undefined")
xlp.isMozilla = !(typeof document.mozFullScreenEnabled == "undefined")

xlp.parseXML = function(xmlStr) {
    if (typeof xmlStr != 'string') {
        xmlStr = String(xmlStr)
    }
    if (xlp.isIE && new window.ActiveXObject("Microsoft.XMLDOM")) {
        var xmlDoc = new window.ActiveXObject("Microsoft.XMLDOM")
        xmlDoc.async = "false"
        xmlDoc.loadXML(xmlStr)
        return xmlDoc
    } else if (typeof window.DOMParser != "undefined") {
        return ( new window.DOMParser() ).parseFromString(xmlStr, "text/xml");
    }
}

xlp.parseXMLC = function(xmlStr) {
    var indoc = xlp.parseXML(xmlStr)
    if (indoc.nodeType == indoc.DOCUMENT_NODE) {
        if (indoc.documentElement.nodeName == "parsererror"
            || (indoc.documentElement.namespaceURI == "http://www.w3.org/1999/xhtml"
                && indoc.documentElement.lastElementChild.firstElementChild.nodeName == "parsererror")) {
            return undefined
        }
        return indoc
    }
}

xlp.sendRequest = function(URL, method, callback, headers, data) {
    if (typeof URL == 'object') {
        return xlp.sendRequest(URL.URL || URL.src || URL.href,
                               URL.method || undefined,
                               URL.callback || undefined,
                               URL.headers || undefined,
                               URL.data || undefined)
    }

    if (!method) method = 'GET'
    if (!callback) callback = function(){}
    if (!headers) headers = {}
    if (!data) data = ''

    var request, k

    if (xlp.isIE) {
        request = new ActiveXObject("Msxml2.XMLHTTP")
    } else if (window.XMLHttpRequest) {
        request = new XMLHttpRequest()
    }

    request.onreadystatechange = function () {
        if (request.readyState == 4) {
            if (request.status == 200) {
                callback(0, request)
            } else if (request.status == 302) {
                // impossible to catch 302
                // https://stackoverflow.com/questions/199099/how-to-manage-a-redirect-request-after-a-jquery-ajax-call
                // but:
                // https://javascriptinfo.com/view/409417/follow-redirect-302-in-xmlhttprequest
                newurl = this.getResponseHeader("Location")
                console.error('XLP: ' + URL + ': Redirect ' + request.status + ', to: ' + newurl)
                callback(-2, request)
            } else {
                console.error('XLP: ' + URL + ': Could not load ' + request.status + ', msg: ' + request.response)
                callback(-1, request)
            }
        } else {
            // console.log('XLP: ' + URL + ' readyState=' + request.readyState)
        }
    }

    request.open(method, URL)
    for (k in headers) {
        request.setRequestHeader(k, headers[k])
    }
//    console.log('XMLHttpRequest send: ' + method + ' ' + URL + ', headers: ' + headers + ', data: ' + data)
    request.send(data)
}

xlp.sendGet = function(URL, callback) {
    if (typeof URL == 'object') {
        URL.method = 'GET'
        xlp.sendRequest(URL)
    } else {
        xlp.sendRequest(URL, 'GET', callback)
    }
}

xlp.sendPost = function(URL, data, headers, callback) {
    if (typeof URL == 'object') {
        URL.method = 'POST'
        xlp.sendRequest(URL)
    } else {
        xlp.sendRequest(URL, 'POST', callback, headers, data)
    }
}

xlp.mkFormData = function(src) {
    return new FormData(src)
}

xlp.mkFormDataDict = function(src) {
    var k, elem, res = {}, sep = '', sres
    for (k = 0; k < src.elements.length; ++k) {
        elem = src.elements[k]
        if (elem.tagName == 'FIELDSET') {
            sres = xlp.mkFormDataDict(elem)
            res = Object.assign({}, res, sres)
        } else if ((elem.type != 'radio' && elem.type != 'checkbox' && elem.name != '') || elem.checked) {
            res[elem.name] = elem.value.trim()
        }
    }
    return res
}

xlp.mkFormSearch = function(src) {
    var k, elem, res = '', sep = ''
    for (k = 0; k < src.elements.length; ++k) {
        elem = src.elements[k]
        if (res.length > 0) sep = '&'
        if (elem.name == 'csrfmiddlewaretoken') {
        } else if (elem.type == 'submit') {
        } else if (elem.tagName == 'INPUT' || elem.tagName == 'TEXTAREA') {
            data = encodeURI(elem.value.trim())
            data = data.replace('+', '%2B')
            if ((elem.type != 'radio' && elem.type != 'checkbox') || elem.checked) {
                res += sep + elem.name + '=' + data
            }
        } else if (elem.tagName == 'FIELDSET' && false) {
            res += sep + xlp.mkFormData(elem)
        }
    }
    return res
}

xlp.reqXML = function(src, obj) {
    if (src.nodeType == src.ELEMENT_NODE && src.nodeName == "FORM") {
        if (obj.method == 'get') {
            obj.URL = obj.URL + '?' + xlp.mkFormSearch(src)
        } else {
            obj.data = xlp.mkFormData(src)
        }
    }
    var cur_callback = obj.callback
    obj.callback = function(status, request) {
        if (status == 0) {
	    if (obj.returnJSON) {
		var json
		try {
		    json = JSON.parse(request.responseText)
                    cur_callback(json, request)
		} catch (error) {
                    xlp.error('No valid JSON response from server: ' + obj.URL)
                    cur_callback(0, request, 'no JSON')
		}
	    } else if (obj.returnData) {
                cur_callback(request.responseText, request)
	    } else {
		var rdoc
		if (xlp.isIE) {
                    rdoc = parseXML(request.responseText)
		} else {
                    rdoc = request.responseXML
		}
		if (rdoc) {
                    cur_callback(rdoc, request)
		} else {
                    xlp.error('No valid XML response from server: ' + obj.URL)
                    cur_callback(0, request, 'no XML')
		}
	    }
        } else {
            xlp.error('Error response: ' + request.status + ' ' + request.statusText)
            cur_callback(0, request, 'request failed')
        }
    }
    xlp.sendRequest(obj)
}

xlp.reqJSON = function(src, obj) {
    obj.returnJSON = true
    xlp.reqXML(src, obj)
}

xlp.reqData = function(src, obj) {
    obj.returnData = true
    xlp.reqXML(src, obj)
}

xlp.submitForm = function(src, url, done) {
    xlp.reqXML(src, { URL: url, callback: done, method: src.method })
}

xlp.loadXML = function(path, callback) {
    xlp.reqXML(document,  {'method': 'GET', 'URL': path, 'callback': callback})
}

xlp.loadJSON = function(path, callback) {
    xlp.reqJSON(document,  {'method': 'GET', 'URL': path, 'callback': callback})
}

xlp.loadData = function(path, callback) {
    xlp.reqData(document,  {'method': 'GET', 'URL': path, 'callback': callback})
}

xlp.mkLoadCached = function() {
    var requested = {}, docs = {}
    var loadCached = function(url, done) {
        var lev
        if (docs[url]) {
            done(docs[url])
        } else {
            if (requested[url]) {
                var levHandler = function(ev) {
                    done(docs[url])
                    document.removeEventListener('doc-loaded'+url, levHandler)
                }
                document.addEventListener('doc-loaded'+url, levHandler)
            } else {
                requested[url] = 1
                xlp.loadXML(url, function(doc) {
                    docs[url] = doc
                    lev = document.createEvent('Event')
                    lev.initEvent('doc-loaded'+url, true, true)
                    document.dispatchEvent(lev)
                    done(doc)
                })
            }
        }
    }
    return loadCached
}

xlp.loadCached = xlp.mkLoadCached()

xlp.fixKonqTransformationResult = function(doc) {
    if ((node=selectSingleNode(doc, "/html/body/*")))
    {
        doc.replaceChild(node, doc.documentElement)
    }
}

xlp.transform = function(xslt, xml) {
    var result, xsltproc

    // IE method
    if (xlp.isIE) {
        result = new ActiveXObject("MSXML2.DOMDocument")
        xml.transformNodeToObject(xslt, result)

        // Other browsers
    } else {
        xsltproc = new XSLTProcessor()
        xsltproc.importStylesheet(xslt)
        result = xsltproc.transformToDocument(xml)
        if (xlp.isKonq) {
            fixKonqTransformationResult(result)
        }
    }

    return result
}

xlp.xPath_selectSingleNode = function(doc, xpath) {
    var res = doc.evaluate(xpath, doc, null, XPathResult.ANY_TYPE, null)
    return res.iterateNext()
}
xlp.xPath_selectString = function(doc, xpath) {
    var res = doc.evaluate(xpath, doc, null, XPathResult.STRING_TYPE, null)
    return res.stringValue
}

xlp.transformToFragment = function(xslt, xml) {
    var result, xsltproc

    if (xlp.isIE) {
        result = parseXML(xml.transformNode(xslt))
    } else {
        xsltproc = new XSLTProcessor()
        xsltproc.importStylesheet(xslt)
        result = xsltproc.transformToFragment(xml, document)
    }

    return result
}

xlp.serializeNode = function(result) {
    var x, ser, s = ''

    // IE method.
    if (result.childNodes[0] && result.childNodes[0].xml) {
        for (x = 0; x < result.childNodes.length; x += 1) {
            s += result.childNodes[x].xml
        }
        // Other browsers
    } else {
        ser = new XMLSerializer()
        for (x = 0; x < result.childNodes.length; x += 1) {
            s += ser.serializeToString(result.childNodes[x])
        }
    }

    return s
}

xlp.mkpre = function(text) {
    var pre = document.createElement("PRE")
    pre.innerHTML = text
    return pre
}

xlp.log = function(txt) { console.log('XLP: ' + txt) }
xlp.error = function(txt) { console.error('XLP: ' + txt) }

xlp.getdoc = function(docstr, opts, done) {
    var res = docstr
    if (typeof docstr == "string") {
        if (docstr[0] == "<") {
            res = xlp.parseXML(docstr)
            done(res)
        } else if (docstr.length < 1024 && opts.xsltbase != undefined) {
            xlp.loadXML(opts.xsltbase + docstr, function(doc) {
                done(doc)
            })
        } else {
            done(docstr)
        }
    } else {
        done(docstr)
    }
}

xlp.getxsl = function(docstr, xslbase, done) {
    var res
    if (typeof docstr == "string") {
        if (docstr[0] == "<") {
            res = xlp.parseXML(docstr)
            done(res)
        } else {
            xlp.loadCached(xslbase + docstr, function(xsl) {
                done(xsl)
            })
        }
    } else {
        done(docstr)
    }
}

xlp.attach = function(elid, htmlfrag, done) {
    var c
    if (typeof elid == "string")
        element = document.getElementById(elid)
    else element = elid
    if (element && element.nodeType) {
        while (c=element.lastChild) element.removeChild(c)
        element.appendChild(htmlfrag)
        if (typeof done == "function")
            done(element, element.lastElementChild, 1)
    } else {
        xlp.error('XLP: element ' + elid + ' is null')
        if (typeof done == "function")
            done(element)
    }
}

xlp.XSL =
xlp.mkXSL = function(xslt, xsltbase) {
    function step(xml, done, toDoc) {
        xlp.getxsl(xslt, xsltbase, function(xsl) {
            xlp.getdoc(xml, {}, function(xmldoc) {
                var res
//                console.log('XSLT: ' + xslt)
                if (toDoc) {
                    res = xlp.transform(xsl, xmldoc)
                } else {
                    res = xlp.transformToFragment(xsl, xmldoc)
                }
                done(res)
            })
        })
    }
    var transform = function(indoc, toDoc, done) {
        if (typeof done == "undefined") {
            done = toDoc
            toDoc = true
        }
        step(indoc, done, toDoc)
    }
    var transformToFragment = function(indoc, done) {
        transform(indoc, false, done)
    }
    var XSL = {
        xslt: xslt,
        xsltbase: xsltbase,
        transform: transform,
        transformToFragment: transformToFragment,
        getdoc: xlp.getdoc,
        attach: xlp.attach,
        mkpre: xlp.mkpre,
    }
    return XSL
}

xlp.XLP =
xlp.mkXLP = function(xslts, xsltbase, options) {
    function step(xml, toDoc, done, j) {
        if (j == undefined) j = 0
        var xslt = xslts[j]
        var nextStep = function(res) {
            if (j < xslts.length - 1) {
                step(res, toDoc, done, j+1)
            } else {
                if (res.documentElement != undefined
                    && res.documentElement.namespaceURI == "http://www.mozilla.org/TransforMiix") {
                    var tn = res.documentElement.firstChild
                    var newres = document.createDocumentFragment()
                    newres.appendChild(tn)
                    done(newres)
                } else {
                    done(res)
                }
            }
        }
        if ( (typeof xslt == 'string' && xslt.endsWith('.xsl'))
             || xslt.documentElement != null && xslt.documentElement.namespaceURI == "http://www.w3.org/1999/XSL/Transform" ) {
            var xsl = xlp.XSL(xslts[j], xsltbase)
            xsl.transform(xml, toDoc || j < xslts.length - 1, function(res) {
                nextStep(res)
            })
        } else if ((typeof xslt == 'string' && xslt.endsWith('.xml'))) {
            // another pipeline
            xlp.loadXLP(xsltbase + xslt, xsltbase, function(sxlp) {
                sxlp.transform(xml, toDoc || j < xslts.length - 1, function(res) {
                    nextStep(res)
                })
            })
        } else if (typeof xslt == 'string') {
            // string: function name
            var xsltf = eval(xslt)
            xsltf(xml, function(res) {
                nextStep(res)
            })
        } else if (typeof xslt == 'function') {
            xslt(xml, function(res) {
                nextStep(res)
            })
        } else {
            // unknown type: return filter (constant)
            console.error('XLP filter step type ' + (typeof xslt) + ' not implemented')
            done(xslt)
        }
    }
    var transform = function(indoc, toDoc, done) {
        if (typeof done == "undefined") {
            done = toDoc
            toDoc = (options != undefined && options.output == 'text') ? false : true
        }
        step(indoc, toDoc,
             function(outfrag) {
//                 if (outfrag.nodeType == outfrag.DOCUMENT_FRAGMENT_NODE) {
//                     outfrag = outfrag.textContent
//                 }
                 done(outfrag)
             })
    }
    var transformTxt = function(instr, toDoc, done) {
        if (typeof done == "undefined") {
            done = toDoc
            toDoc = (options != undefined && options.output == 'text') ? false : true
        }
        var indoc = xlp.parseXML(instr)
        transform(indoc, toDoc,
                  function(outfrag) {
                      done(outfrag)
                  })
    }
    var XLP = {
        xslts: xslts,
        xsltbase: xsltbase,
        transform: transform,
        transformTxt: transformTxt,
        attach: xlp.attach,
        mkpre: xlp.mkpre,
	options: options
    }
    return XLP
}
xlp.readXLP = function(Xdoc, xslbase, done) {
    var getsteps = xlp.mkXLP(['xlp-get-steps.xsl'], xlp.base)
    getsteps.transform(Xdoc, false, function(res) {
        var info = JSON.parse(res.textContent)
        var sxlp = xlp.mkXLP(info, xslbase)
        done(sxlp)
    })
}
xlp.loadXLP = function(XURL, xslbase, done) {
    xlp.loadXML(XURL, function(doc, req) {
        xlp.readXLP(doc, xslbase, done)
    })
}

xlp.amap = function(array, func, done) {
    var n = Object.keys(array).length
    var dones = Array(n)
    dones.fill(0)
    var results
    if (Array.isArray(array)) {
        results = []
    } else {
        results = {}
    }
    Object.keys(array).forEach(function(k) {
        func(array[k], function(res) {
            console.log('amap: ' + k + ' of ' + n + ' ' + array[k])
            dones[k] = 1
            results[k] = res
            if (dones.every((x) => { return x>0 })) {
                done(results)
            }
        })
    })
}

xlp.mloadXML = function(URLs, done) {
    xlp.amap(URLs, function(url, done) {
        xlp.loadXML(url, function(doc, req) {
            done(doc)
        })
    }, done)
}

xlp.getbase = function() {
    var getUrl = window.location
    var baseUrl = getUrl.protocol + '//' + getUrl.host + '/'
    return baseUrl
}

xlp.init = function() {
    console.log('xlp.init')
}

function xlp_init() {
    xlp.init()
}

console.log('xlp loaded')
