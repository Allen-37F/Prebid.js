import Adapter from 'src/adapters/adapter';
import bidfactory from 'src/bidfactory';
import bidmanager from 'src/bidmanager';
import * as utils from 'src/utils';
import { ajax } from 'src/ajax';
import { STATUS } from 'src/constants';

const ENDPOINT = '//ads.bf.rebel.ai/bid.json?exchange_id=';

//tag id: 0a47f4ce-d91f-48d0-bd1c-64fa2c196f13

function BeachfrontAdapter() {
  var baseAdapter = Adapter.createNew('beachfront'),
    bidRequest;


  // take bid requests and send them out to get bid responses.
  baseAdapter.callBids = function (bidRequests) {
    if (!bidRequests || !bidRequests.bids || bidRequests.bids.length === 0) {
      return;
    }

    var RTBDataParams = prepareAndSaveRTBRequestParams(bidRequests.bids[0]);

    // This log makes sure we have parameters to put in the ad request.
    // console.log("RTB Data Params are: " + JSON.stringify(RTBDataParams));

    if (!RTBDataParams) {
      return;
    }

    var BID_URL = ENDPOINT + RTBDataParams.appId;

    ajax(BID_URL, handleResponse, JSON.stringify(RTBDataParams), {
      contentType: 'text/plain',
      withCredentials: true
    });
  };

  function prepareAndSaveRTBRequestParams(bid) {
    if (!bid || !bid.params) {
      return;
    }

    bidRequest = bid;
    bidRequest.width = parseInt(bid.sizes[0], 10) || undefined;
    bidRequest.height = parseInt(bid.sizes[1], 10) || undefined;

    var bidRequestObject =  {
      isPrebid: true,
      appId: bid.params.appId || undefined,
      domain: document.location.hostname,
      imp:[{
        video:{},
        bidfloor: pbjs.adUnits[0].bidfloor
      }],
      site:{
        page:"http://www.rebelai.com"
      },
      device:{
        ua: navigator.userAgent,
        // XXX how do i get the ip address?
        ip:"100.6.143.143",
        // XXX if this is anything other than 1, no ad is returned
        devicetype:1
      },
      cur:[pbjs.adUnits[0].cur || "USD"]
    };

    console.log("Bidfloor is $" + pbjs.adUnits[0].bidfloor);

    if (bidRequestObject.appId.length !== 36) {
      console.error("Bid request failed. Ensure your appId is accurate.");
    } else if (!pbjs.adUnits[0].bidfloor){
      console.error("Bid request failed. No bid floor specified.");
    } else {
      console.log("Bid request is successful: ");
      console.log(bidRequest);
      console.log(bidRequestObject);
      return bidRequestObject;
    }
  }

  /* Notify Prebid of bid responses so bids can get in the auction */
  function handleResponse(response) {
    var parsed;

    try {
      parsed = JSON.parse(response);
    } catch (error) {
      utils.logError(error);
    }

    var newBid = {};
    newBid.price = parsed.seatbid[0].bid[0].price;
    console.log("At least one bid came back, with a CPM of $" + newBid.price);

    // The XML from bid 0 is found at: parsed.seatbid[0].bid[0].adm
    var parserBF = new DOMParser();
    var xmlBF;

    try {
      xmlBF = parserBF.parseFromString(parsed.seatbid[0].bid[0].adm,"text/xml");
    }
    catch(err){
      console.log("error object: " + err);
      parsed.error = true;
    }

    var xml_uri = xmlBF.getElementsByTagName('VASTAdTagURI')[0];
    var xml_uri_child = xml_uri.childNodes[0];
    console.log("XML URI: "+ xml_uri_child.nodeValue);
    newBid.url=xml_uri_child.nodeValue;

    // Final parsed ad tag uri in the response: xml_uri_child.nodeValue

    if (!parsed ) {
      bidmanager.addBidResponse(bidRequest.placementCode, createBid(STATUS.NO_BID));
      console.log("Status is no bid. Check yourself.");
      return;
    }
    bidmanager.addBidResponse(bidRequest.placementCode, createBid(STATUS.GOOD, newBid));
    console.log("Status is good! Bid accepted!");
  }

  function createBid(status, tag) {
    var bid = bidfactory.createBid(status, tag);
    if (!tag || status !== STATUS.GOOD) {
      console.log("Failing: " + tag + status);
      return bid;
    }

    bid.cpm = tag.price;
    bid.creative_id = tag.cmpId;
    bid.width = bidRequest.width;
    bid.height = bidRequest.height;
    bid.descriptionUrl = tag.url;
    bid.vastUrl = tag.url;
    bid.code = baseAdapter.getBidderCode();
    bid.bidderCode = bidRequest.bidder;
    bid.mediaType = 'video';

    bid.statusCode = 1;

    console.log("Bid object is ");
    console.log(bid);

    return bid;
  }

  return {
    createNew: BeachfrontAdapter.createNew,
    callBids: baseAdapter.callBids,
    setBidderCode: baseAdapter.setBidderCode
  };
}

BeachfrontAdapter.createNew = function () {
  return new BeachfrontAdapter();
};

module.exports = BeachfrontAdapter;
