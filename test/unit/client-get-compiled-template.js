'use strict';

const expect = require('chai').expect;
const injectr = require('injectr');
const sinon = require('sinon');

describe('client : get-compiled-template', function(){

  let getCompiledTemplate;

  const initialise = function(requestStub){

    const GetCompiledTemplate = injectr('../../client/src/get-compiled-template.js', {
      'minimal-request': requestStub,
      './try-get-cached': sinon.stub()
    });

    getCompiledTemplate = new GetCompiledTemplate();
  };

  describe('when template file request fails', function(){
    
    const errorExample = '<?xml version="1.0" encoding="UTF-8"?><Error><Code>AccessDenied</Code><Message>' +
      'Access Denied</Message><RequestId>1234567890</RequestId><HostId>asdfghjklqwertyuiop</HostId></Error>';
    
    let requestStub = sinon.stub().yields(403, errorExample),
        error;

    before(function(done){
      initialise(requestStub);

      const template = {
        key: 'hash1234567890',
        src: 'https://cdn.com/components/1.3.5/template.js'
      };

      getCompiledTemplate(template, false, 5, function(err){
        error = err;
        done();
      });
    });

    it('should return an error containing the details', function(){
      expect(error).to.eql({
        status: 403,
        response: {
          error: 'request https://cdn.com/components/1.3.5/template.js failed ('+ errorExample +')'
        }
      });
    });
  });
});