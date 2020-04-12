'use strict';

/**
 * @ngdoc function
 * @name brnaiApp.controller:SequencesCtrl
 * @description
 * # SequencesCtrl
 * Controller of the brnaiApp
 */
angular.module('brnaiApp')
  .controller('SequencesCtrl', ['$scope', '$http', 'sequencesservice', '$stateParams', 'getDomainData', '$cookies', 'Notification', '$state',
    function ($scope, $http, sequencesservice, $stateParams, getDomainData, $cookies, Notification, $state) {
      $scope.loading = true;
      $scope.inProgress = true;
      $scope.bot_id = $state.params.id;

      $scope.options = {
        limit: 30,
        offset: 0,
        page: 0,
        lastPage: false
      };

      $scope.sequences = sequencesservice.getSequences();

      $scope.selectedSequence = {};

      $state.activeId = $state.params.category;

      $scope.goto = function (b_id, sequence) {
        $state.go('sequences', {id: b_id, sequence: sequence});
        $state.activeId = sequence;
      };

      $scope.check = function (id) {
        return $state.activeId == id;
      };
    }
  ]);
