'use strict';

/**
 * @ngdoc function
 * @name brnaiApp.controller:PinterestCtrl
 * @description
 * # PinterestCtrl
 * Controller of the brnaiApp
 */
angular.module('brnaiApp')
    .controller('PinterestCtrl', function ($scope, $http, $stateParams, getDomainData, Auth, $uibModalInstance, Notification) {

        $scope.pinterest = {
            account_id: Auth.getUser().account_id,
            provider_data: {
                username: '',
                password: '',
                email: '',
                proxy: ''
            }
        };
        $scope.exist = false;
        $scope.isProgres = false;

        function getPinterest(password) {
            $http.get(getDomainData.host + '/connection/' + $stateParams.id +'/pinterest', {notification: false} )
                .then(function (response) {
                    if (response.data.status){
                        $scope.pinterest.account_id = Auth.getUser().account_id;
                        $scope.pinterest.provider_data = response.data.provider_data;
                        $scope.exist = true;

                        if(password) {
                            $scope.pinterest.provider_data.password = password;
                        }
                    }
                }, function (error) {
                });
        }

        getPinterest();

        $scope.updateConnection = function () {
            if($scope.isProgres) return;
            $scope.isProgres = true;
            if(!$scope.exist) {
                $scope.addConnection();
                return;
            }
            $http.put(getDomainData.host + '/connection/pinterest/' + $stateParams.id, $scope.pinterest)
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
            $http.post(getDomainData.host + '/connection/pinterest/' + $stateParams.id, $scope.pinterest)
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

            $http.delete(getDomainData.host + '/connection/pinterest/' + $stateParams.id).then(function (response) {
                if (response.data.status) {
                    $uibModalInstance.close('ok');
                } else {
                    Notification.error({ delay: 60000, message: response.data.error});
                }
            }, function (error) {
            });

        };
    });
