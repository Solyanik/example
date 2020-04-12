'use strict';

/**
 * @ngdoc function
 * @name brnaiApp.controller:RedditCtrl
 * @description
 * # RedditCtrl
 * Controller of the brnaiApp
 */
angular.module('brnaiApp')
    .controller('RedditCtrl', function ($scope, $http, domain, $stateParams, getDomainData, Auth, $uibModalInstance, Notification) {

        $scope.reddit = {
            account_id: Auth.getUser().account_id,
            provider_data: {
                username: '',
				login: '',
                password: ''
            }
        };
        $scope.exist = false;
        $scope.isProgres = false;

        function getReddit(password) {
            $http.get(getDomainData.host + '/connection/' + $stateParams.id +'/reddit', {notification: false} )
                .then(function (response) {
                    if (response.data.status){
                        $scope.reddit.account_id = Auth.getUser().account_id;
                        $scope.reddit.provider_data = response.data.provider_data;
                        $scope.exist = true;

                        if(password) {
                            $scope.reddit.provider_data.password = password;
                        }
                    }
                }, function (error) {
                });
        }

        getReddit();

        $scope.updateConnection = function () {
            if($scope.isProgres) return;
            $scope.isProgres = true;
            if(!$scope.exist) {
                $scope.addConnection();
                return;
            }
            $http.put(getDomainData.host + '/connection/reddit/' + $stateParams.id, $scope.reddit)
                .then(function (response) {
                    $scope.isProgres = false;
                    if (response.data.status) {
                        $uibModalInstance.close('ok');
                    } else {

                        Notification.error({ delay: 60000, message: response.data.error});
                    }
                }, function (error) {
                })
        };

        $scope.addConnection = function () {
            $http.post(getDomainData.host + '/connection/reddit/' + $stateParams.id, $scope.reddit)
                .then(function (response) {
                    $scope.isProgres = false;
                    if (response.data.status) {
                        $uibModalInstance.close('ok');
                    } else {

                        Notification.error({ delay: 60000, message: response.data.error});
                    }
                }, function (error) {
                })
        }

        $scope.close = function () {
            $uibModalInstance.close('ok');
        }

        $scope.deleteConnection = function () {

            $http.delete(getDomainData.host + '/connection/reddit/' + $stateParams.id).then(function (response) {
                if (response.data.status) {
                    $uibModalInstance.close('ok');
                } else {
                    Notification.error({ delay: 60000, message: response.data.error});
                }
            }, function (error) {
            });

        };
    });
