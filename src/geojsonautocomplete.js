/* 
    Created on : Aug 31, 2015
    Author     : yeozkaya@gmail.com
*/
;
(function ($) {

    var options = {
        geojsonServiceAddress: "http://yourGeoJsonSearchAddress",
        placeholderMessage: "Search...",
        searchButtonTitle: "Search",
        clearButtonTitle: "Clear",
        foundRecordsMessage: "showing results.",
        limit: 10,
        notFoundMessage: "not found.",
        notFoundHint: "Make sure your search criteria is correct and try again.",
        drawColor: "blue",
        pointGeometryZoomLevel: -1, //Set zoom level for point geometries -1 means use leaflet default.
        pagingActive: true,
        searchLayerType: 'simple',
        onActiveResultChange: function(map, feature, activeResult) {
            if (options.searchLayerType === 'multiple') {
                focusGeoJson(activeResult);
            }
            else {
                drawGeoJson(activeResult);
            }
        }
    };

    var activeResult = -1;
    var resultCount = 0;
    var lastSearch = "";
    var searchLayer;
    var focusLayer;
    var features = [];
    var featureCollection = [];
    var offset = 0;
    var collapseOnBlur = true;
    var map, $element, $searchBox, $searchButton, $clearButton, $resultsDiv;

    $.fn.GeoJsonAutocomplete = function (mapToWork, userDefinedOptions) {
        var keys;
        map = mapToWork;
        keys = Object.keys(userDefinedOptions);

        for (var i = 0; i < keys.length; i++) {
            options[keys[i]] = userDefinedOptions[keys[i]];
        }

        $element = $(this);

        if ($element.length > 1) {
            throw new Error("Leaflet.GeoJSONAutocomplete doesn't support multiple elements.");
        }

        $element.addClass("searchContainer");
        $element.append('<input class="searchBox" placeholder="' + options.placeholderMessage + '"/>');
        $element.append('<input class="searchButton" type="submit" value="" title="' + options.searchButtonTitle + '"/>');
        $element.append('<span class="divider"></span>');
        $element.append('<input class="clearButton" type="submit"  value="" title="' + options.clearButtonTitle + '">');

        $searchBox = $element.find('.searchBox');
        $searchButton = $element.find('.searchButton');
        $clearButton = $element.find('.clearButton');

        $searchBox.val('');
        $searchBox.delayKeyup(function (event) {
            switch (event.keyCode) {
                case 13: // enter
                    getValuesAsGeoJson();
                    break;
                case 38: // up arrow
                    prevResult();
                    break;
                case 40: // down arrow
                    nextResult();
                    break;
                case 37: //left arrow, Do Nothing
                case 39: //right arrow, Do Nothing
                    break;
                default:
                    if ($searchBox.val().length > 0) {
                        offset = 0;
                        getValuesAsGeoJson();
                    }
                    else {
                        clearButtonClick();
                    }
                    break;
            }
        }, 300);

        $searchBox.focus(function () {
            if ($resultsDiv) {
                $resultsDiv.css('visibility', 'visible');
            }
        });

        $searchBox.blur(function () {
            if ($resultsDiv) {
                if (collapseOnBlur) {
                    $resultsDiv.css('visibility', "collapse");
                }
                else {
                    collapseOnBlur = true;

                    setTimeout(function ()
                    {
                        $searchBox.focus();
                    }, 0);
                }
            }

        });

        $searchButton.click(function () {
            getValuesAsGeoJson();
        });

        $clearButton.click(function () {
            clearButtonClick();
        });
    };

    $.fn.delayKeyup = function (callback, ms) {
        var timer = 0;
        $(this).keyup(function (event) {

            if (event.keyCode !== 13 && event.keyCode !== 38 && event.keyCode !== 40) {
                clearTimeout(timer);
                timer = setTimeout(function () {
                    callback(event);
                }, ms);
            }
            else {
                callback(event);
            }
        });
        return $(this);
    };

    function getValuesAsGeoJson()
    {
        var $searchBox = $element.find('.searchBox');
        activeResult = -1;
        features = [];
        featureCollection = [];
        var limitToSend = options.limit;
        if (options.pagingActive) {
            limitToSend++;
        }

        lastSearch = $searchBox.val();

        if (lastSearch === "") {
            return;
        }

        var data = {
            search: lastSearch,
            limit: limitToSend
        };
        
        if (options.pagingActive) {
            data.offset = offset;
        }
        
        $.ajax({
            url: options.geojsonServiceAddress,
            type: 'GET',
            data: data,
            dataType: 'json',
            success: function (json) {
                
                if (json.type === "Feature") {
                    resultCount = 1;
                    features[0] = json;
                    featureCollection = json;
                }
                else {
                    resultCount = json.features.length;
                    features = json.features;

                    if (limitToSend === resultCount) {
                        featureCollection = json.features.slice(0, json.features.length - 1);
                    }
                    else {
                        featureCollection = json.features;
                    }
                }

                createDropDown();
            },
            error: function () {
                processNoRecordsFoundOrError();
            }
        });
    }

    function createDropDown()
    {
        var $searchBox = $element.find('.searchBox'), $resultList;

        if ($resultsDiv) { $resultsDiv.remove() };
        $element.append("<div class='result'><ul class='list'></ul><div>");

        $resultsDiv = $element.find('.result');
        $resultList = $resultsDiv.find('.list');

        $resultsDiv.css('position', $searchBox.css('position'));
        $resultsDiv.css('left', (parseInt($searchBox.css('left')) - 10) + "px");
        $resultsDiv.css('bottom', $searchBox.css('bottom'));
        $resultsDiv.css('right', $searchBox.css('right'));
        $resultsDiv.css('top', (parseInt($searchBox.css('top')) + 25) + "px");
        $resultsDiv.css('zIndex', $searchBox.css('zIndex'));

        var loopCount = features.length;
        var hasMorePages = false;
        if (options.pagingActive && features.length === options.limit + 1) { //Has more pages
            loopCount--;
            hasMorePages = true;
            resultCount--;
        }

        for (var i = 0; i < loopCount; i++) {

            var html = "<li id=\"listElement" + i + "\" class='listResult'>";
            html += "<span id='listElementContent" + i + "' class='content'><img src='./image/" + features[i].properties.image + "' class='iconStyle' align='middle'>";
            html += "<font size='2' color='#333' class='title'>" + features[i].properties.title + "</font><font size='1' color='#8c8c8c'> " + features[i].properties.description + "<font></span></li>";

            $resultList.append(html);

            $resultList.find("#listElement" + i).mouseenter(function () {
                listElementMouseEnter(this);
            });

            $resultList.find("#listElement" + i).mouseleave(function () {
                listElementMouseLeave(this);
            });

            $resultList.find("#listElement" + i).mousedown(function () {
                listElementMouseDown(this);
            });
        }

        if (options.pagingActive) {
            var prevPic = "prev.png";
            var nextPic = "next.png";
            var prevDisabled = "";
            var nextDisabled = "";

            if (offset === 0) {
                prevPic = "prev_dis.png";
                prevDisabled = "disabled";
            }

            if (!hasMorePages) {
                nextPic = "next_dis.png";
                nextDisabled = "disabled";
            }

            var htmlPaging = "<div align='right' class='pagingDiv'>" + (offset + 1) + " - " + (offset + loopCount) + " " + options.foundRecordsMessage + " ";
            htmlPaging += "<input type='image' src='../dist/image/" + prevPic + "' width='16' height='16' class='pagingArrow pagingPrev' " + prevDisabled + ">";
            htmlPaging += "<input type='image' src='../dist/image/" + nextPic + "' width='16' height='16' class='pagingArrow pagingNext' " + nextDisabled + "></div>";
            $resultsDiv.append(htmlPaging);

            $resultsDiv.find(".pagingPrev").click(function () {
                prevPaging();
            });

            $resultsDiv.find(".pagingNext").click(function () {
                nextPaging();
            });  
        }

        if (options.searchLayerType === 'multiple') {
            drawGeoJsonList();
        }
    }

    function listElementMouseEnter(listElement) {

        var index = parseInt(listElement.id.substr(11));

        if (index !== activeResult) {
            $('#listElement' + index).toggleClass('mouseover');
        }
    }

    function listElementMouseLeave(listElement) {
        var index = parseInt(listElement.id.substr(11));

        if (index !== activeResult) {
            $('#listElement' + index).removeClass('mouseover');
        }
    }

    function listElementMouseDown(listElement) {
        var index = parseInt(listElement.id.substr(11));

        if (index !== activeResult) {
            if (activeResult !== -1) {
                $('#listElement' + activeResult).removeClass('active');
            }

            $('#listElement' + index).removeClass('mouseover');
            $('#listElement' + index).addClass('active');

            activeResult = index;
            fillSearchBox();
            onActiveResultChange();
        }
    }

    function drawGeoJsonList() {
        if (searchLayer !== undefined) {
            map.removeLayer(searchLayer);
            searchLayer = undefined;
        }

        searchLayer = L.geoJson(featureCollection, {
            style: function (feature) {
                return {color: "#D0473B"};
            },
            pointToLayer: function (feature, latlng) {
                return new L.CircleMarker(latlng, {radius: 5, fillOpacity: 0.85});
            },
            onEachFeature: function (feature, layer) {
                layer.bindPopup(feature.properties.popupContent);
            }
        });

        map.addLayer(searchLayer);

        map.fitBounds(searchLayer.getBounds());
    }

    function focusGeoJson(index) {

        if (features[index].geometry.type === "Point" && options.pointGeometryZoomLevel !== -1) {
            map.setView([features[index].geometry.coordinates[1], features[index].geometry.coordinates[0]], options.pointGeometryZoomLevel);
        }
        else {
            map.fitBounds(getBoundsOfGeoJsonObject(features[index].geometry));
        }
        drawGeoJsonOnFocusLayer(index);
    }

    function getBoundsOfGeoJsonObject(geometry) {

        var geojsonObject = L.geoJson(geometry, {
            onEachFeature: function (feature, layer) {
            }
        });

        return geojsonObject.getBounds();
    }

    function drawGeoJson(index) {

        if (searchLayer !== undefined) {
            map.removeLayer(searchLayer);
            searchLayer = undefined;
        }

        if (index === -1)
            return;

        var drawStyle = {
            color: options.drawColor,
            weight: 5,
            opacity: 0.65,
            fill: false
        };

        searchLayer = L.geoJson(features[index].geometry, {
            style: drawStyle,
            onEachFeature: function (feature, layer) {
                layer.bindPopup(features[index].properties.popupContent);
            }
        });

        map.addLayer(searchLayer);

        if (features[index].geometry.type === "Point" && options.pointGeometryZoomLevel !== -1) {
            map.setView([features[index].geometry.coordinates[1], features[index].geometry.coordinates[0]], options.pointGeometryZoomLevel);
        }
        else {
            map.fitBounds(searchLayer.getBounds());
        }
    }

    function drawGeoJsonOnFocusLayer(index) {

        if (focusLayer !== undefined) {
            map.removeLayer(focusLayer);
            focusLayer = undefined;
        }

        if (index === -1)
            return;

        var drawStyle = {
            color: options.color,
            weight: 5,
            opacity: 0.65,
            fill: false
        };

        focusLayer = L.geoJson(features[index].geometry, {
            style: drawStyle,
            onEachFeature: function (feature, layer) {
                layer.bindPopup(features[index].properties.popupContent);
            }
        });

        map.addLayer(focusLayer);
    }

    function fillSearchBox() {
        if (activeResult === -1) {
            $searchBox.val(lastSearch);
        }
        else {
            $searchBox.val(features[activeResult].properties.title);
        }
    }

    function nextResult() {

        if (resultCount > 0) {
            if (activeResult !== -1) {
                $('#listElement' + activeResult).toggleClass('active');
            }

            if (activeResult < resultCount - 1) {
                $('#listElement' + (activeResult + 1)).toggleClass('active');
                activeResult++;
            }
            else {
                activeResult = -1;
            }

            fillSearchBox();

            if (activeResult !== -1) {
                onActiveResultChange();
            }
        }
    }

    function prevResult() {
        if (resultCount > 0) {
            if (activeResult !== -1) {
                $('#listElement' + activeResult).toggleClass('active');
            }

            if (activeResult === -1) {
                $('#listElement' + (resultCount - 1)).toggleClass('active');
                activeResult = resultCount - 1;
            }
            else if (activeResult === 0) {
                activeResult--;
            }
            else {
                $('#listElement' + (activeResult - 1)).toggleClass('active');
                activeResult--;
            }

            fillSearchBox();

            if (activeResult !== -1) {
                onActiveResultChange();
            }
        }
    }

    function onActiveResultChange()
    {
        options.onActiveResultChange(map, features[activeResult], activeResult);
    }

    function clearButtonClick()
    {
        $searchBox.val('');
        lastSearch = "";
        resultCount = 0;
        features = [];
        activeResult = -1;
        $resultsDiv.remove();
        if (searchLayer !== undefined) {
            map.removeLayer(searchLayer);
            searchLayer = undefined;
        }
        if (focusLayer !== undefined) {
            map.removeLayer(focusLayer);
            focusLayer = undefined;
        }
    }

    function processNoRecordsFoundOrError()
    {
        resultCount = 0;
        features = [];
        activeResult = -1;

        $resultsDiv.remove();
        
        if (searchLayer !== undefined) {
            map.removeLayer(searchLayer);
            searchLayer = undefined;
        }

        $resultsDiv.remove();
        $element.append("<div id='resultsDiv' class='result'><i>" + lastSearch + " " + options.notFoundMessage + " <p><small>" + options.notFoundHint + "</small></i><div>");
        $resultsDiv = $element.find('.result');
    }

    function prevPaging()
    {
        $searchBox.val(lastSearch);
        offset = offset - options.limit;
        getValuesAsGeoJson();
        collapseOnBlur = false;
        activeResult = -1;
    }

    function nextPaging() {
        $searchBox.val(lastSearch);
        offset = offset + options.limit;
        getValuesAsGeoJson();
        collapseOnBlur = false;
        activeResult = -1;
    }

})(jQuery);