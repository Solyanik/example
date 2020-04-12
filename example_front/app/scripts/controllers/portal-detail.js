'use strict';

/**
 * @ngdoc function
 * @name brnaiApp.controller:PortalDetailCtrl
 * @description
 * # PortalDetailCtrl
 * Controller of the brnaiApp
 */
angular.module('brnaiApp')
    .controller('PortalDetailCtrl', ['$scope', '$state', 'Notification', 'portalService', 'getDomainData', 'Upload', 'pagesService', '$stateParams', '$http',
        function($scope, $state, Notification, portalService, getDomainData, Upload, pagesService, $stateParams, $http) {
            $scope.payment_data_saved = false;
            $scope.portalPages = [];
            $scope.subscription_plans = [];
            $scope.subscription_plan = {
                name: '',
                title: '',
                description: '',
                properties: {
                    bots: ''
                },
                portal_id: '',
                price: '',
                interval: '',
                active: true,
                is_default: false
            };

            $scope.defaultScenarios = {
                startValue: false,
                defaultValue: false
            };

            $scope.default_botsList = [];

            $scope.newDefaultBot = {
                name: '',
                bot_id: ''
            }

            $scope.modes = [{
                    value: 'free',
                    title: 'Free'
                },
                {
                    value: 'balance',
                    title: 'Balance'
                },
                {
                    value: 'subscription',
                    title: 'Subscription'
                }
            ];

            getPlans();

            function getPlans() {
                $http.get(getDomainData.host + '/subscription-plans/' + $stateParams.id).then(function(response) {
                    if (response.status)
                        $scope.subscription_plans = response.data.plans;
                }, function(error) {});
            }

            let default_botsListBuff = []

            function getDefaultBots() {
                $http.get(getDomainData.host + '/bots/templates/all').then(function(response) {
                    if (response.status)
                        default_botsListBuff = response.data.bots;
                    $scope.default_botsList = getFilteredArray(default_botsListBuff, $scope.portal.properties.default_bots)
                    if (!$scope.portal.properties.default_bots) $scope.portal.properties.default_bots = [];
                }, function(error) {});
            }

            function getFilteredArray(items, filter) {
                if (!filter) return items;
                let res = [];
                angular.forEach(items, function(obj, key) {
                    let index = -1;
                    for (let i = 0; i < filter.length; i++)
                        if (obj.bot_id === filter[i].bot_id) { index = i; break; }
                    if (index == -1) {
                        res.push(obj)
                    }
                });
                return res;
            };

            $http.get(getDomainData.host + '/portal/' + $stateParams.id).then(function(response) {
                if (response.status)
                    $scope.portal = response.data.portal;
                if ($scope.portal.properties.default_scenarios) {
                    $scope.portal.properties.default_scenarios.forEach(function(value) {
                        if (value == "start") {
                            $scope.defaultScenarios.startValue = true;
                        }
                        if (value == "default") {
                            $scope.defaultScenarios.defaultValue = true;
                        }
                    });
                }
                $scope.$watch('portal.properties.balance_threshold', function(value) {
                    if (value > 0) {
                        $scope.portal.properties.balance_threshold = -value;
                    }
                });
                getDefaultBots();
            }, function(error) {});

            $scope.defaultScenariosChange = function() {
                if (!$scope.portal.properties.default_scenarios) {
                    $scope.portal.properties.default_scenarios = [];
                }
                setTimeout(function() {
                    let startValue = searchDefaultScenarios('start');
                    let defaultValue = searchDefaultScenarios('default');
                    if ($scope.defaultScenarios.startValue) {
                        if (!startValue.isExsist) {
                            $scope.portal.properties.default_scenarios.push("start")
                        }
                    } else {
                        if (startValue.isExsist) {
                            $scope.portal.properties.default_scenarios.splice(startValue.index, 1);
                        }
                    }
                    if ($scope.defaultScenarios.defaultValue) {
                        if (!defaultValue.isExsist) {
                            $scope.portal.properties.default_scenarios.push("default")
                        }
                    } else {
                        if (defaultValue.isExsist) {
                            $scope.portal.properties.default_scenarios.splice(defaultValue.index, 1);
                        }
                    }
                    $scope.$apply();
                }, 10);
            }

            function searchDefaultScenarios(item) {
                for (let i = 0; i < $scope.portal.properties.default_scenarios.length; i++) {
                    if ($scope.portal.properties.default_scenarios[i] == item) {
                        return { index: i, isExsist: true };
                    }
                }
                return { index: -1, isExsist: false };
            }

            $scope.addDefaultBot = function() {
                $scope.portal.properties.default_bots.push($scope.newDefaultBot);
                $scope.newDefaultBot = {
                    name: '',
                    bot_id: ''
                }
                $scope.default_botsList = getFilteredArray(default_botsListBuff, $scope.portal.properties.default_bots)
            };

            $scope.deleteDefaultBot = function(index) {
                $scope.portal.properties.default_bots.splice(index, 1);
                $scope.default_botsList = getFilteredArray(default_botsListBuff, $scope.portal.properties.default_bots)
            };


            $scope.addPlan = function() {
                $scope.subscription_plan.portal_id = $scope.portal.portal_id;
                $http.post(getDomainData.host + '/subscription-plan', $scope.subscription_plan)
                    .then(function(response) {

                        if (response.data.status) {
                            {
                                let modal = $('#addIntentModal');
                                modal.modal('hide');
                                getPlans();
                            }

                        } else alert(response.data.error);
                    })
            };

            $scope.editPlan = function(plan_id, index) {
                $http.put(getDomainData.host + '/subscription-plan/' + plan_id, $scope.subscription_plans[index])
                    .then(function(response) {
                        if (response.data.status == true) {
                            let modal = $('#editPlanModal' + plan_id);
                            modal.modal('hide');
                            getPlans();
                        }
                    }, function(error) {})
            };

            $scope.deletePlan = function(plan_id) {
                if (confirm('Are you sure you want to delete plan?')) {
                    $http.delete(getDomainData.host + '/subscription-plan/' + plan_id).then(function(response) {
                        if (response.data && response.data.status && response.data.status == true) {
                            getPlans();
                        } else {
                            alert('Something goes wrong...');
                        }
                    }, function(error) {});
                }
            };


            $scope.langs = [{
                    name: 'EN',
                    value: 'en'
                },
                {
                    name: 'DE',
                    value: 'de'
                }
            ];

            $scope.newPage = null;

            $scope.uploadFile = function(type, file) {
                if (file == null) {
                    return;
                }
                Upload.upload({
                    url: getDomainData.host + '/portal/image/' + $scope.portal.portal_id + '?type=' + type,
                    data: { file: file, name: file.name }
                }).then(function(resp) {
                    let logoImg = '';
                    let faviconImg = '';
                    let widgetImg = '';
                    if (type === 'logo') {
                        $scope.portal.logo = resp.data.name;
                        logoImg = resp.data.image;
                    } else {
                        if (type === 'favicon') {
                            $scope.portal.favicon = resp.data.name;
                            faviconImg = resp.data.image;
                        }
                        if (type === 'widgets.chat.image') {
                            $scope.portal.widgets.chat.image = resp.data.name;
                            widgetImg = resp.data.image;
                        }
                        if (typeof $scope.portal.logo === 'string') {
                            let logoArr = $scope.portal.logo.split('/');
                            logoImg = $scope.portal.logo;
                            $scope.portal.logo = logoArr[logoArr.length - 1];
                        }
                    }

                    if (type !== 'favicon' && (typeof $scope.portal.favicon === 'string')) {
                        let faviconArr = $scope.portal.favicon.split('/');
                        faviconImg = $scope.portal.favicon;
                        $scope.portal.favicon = faviconArr[faviconArr.length - 1];
                    }
                    if (type !== 'widgets.chat.image' && (typeof $scope.portal.widgets.chat.image === 'string')) {
                        let widgetsArr = $scope.portal.widgets.chat.image.split('/');
                        widgetImg = $scope.portal.widgets.chat.image;
                        $scope.portal.widgets.chat.image = widgetsArr[widgetsArr.length - 1];
                    }

                    portalService
                        .updatePortal($scope.portal)
                        .then(function(res) {
                            $scope.portal.logo = logoImg;
                            $scope.portal.favicon = faviconImg;
                            $scope.portal.widgets.chat.image = widgetImg;
                            if (res) {
                                Notification.success({ message: 'Portal ' + $scope.portal.name + ' successfully updated' });
                            } else {
                                Notification.error({ delay: 60000, message: 'Can\'t update portal' });
                            }
                        })
                }, function(resp) {
                    //error
                });
            };

            $scope.onSubmit = function() {
                delete $scope.portal.logo;
                delete $scope.portal.favicon;
                delete $scope.portal.widgets.chat.image;

                portalService
                    .updatePortal($scope.portal)
                    .then(function(res) {
                        if (res) {
                            $scope.payment_data_saved = true;
                            Notification.success({ message: 'Portal ' + $scope.portal.name + ' successfully updated' });
                        } else Notification.error({ delay: 60000, message: 'Can\'t update portal' });
                        $state.go('portals')
                    })
            };

            $scope.deletePortal = function() {
                if (confirm('Are you sure, you want to delete portal?')) {
                    portalService
                        .deletePortal($scope.portal.portal_id)
                        .then(function(res) {
                            if (res) {
                                Notification.success({ message: 'Portal successfully deleted' });
                                $state.go('portals');
                            } else Notification.error({ delay: 60000, message: 'Can\'t delete portal' });
                        })
                }
            };

            $scope.deletePage = function(page) {
                if (confirm('Confirm the action')) {
                    pagesService
                        .deletePage(page, $scope.portal.portal_id)
                        .then(function(res) {
                            if (res) {
                                Notification.success({ message: 'Page ' + page.name + 'successfully deleted' });
                                $scope.portalPages.splice($scope.portalPages.indexOf(page), 1);
                            } else Notification.error({ delay: 60000, message: 'Can\'t delete page' });
                        })
                }
            };

            $scope.addPage = function(page) {
                $http.post(getDomainData.host + '/page', $scope.newPage)
                    .then(function(response) {
                        if (response) {
                            Notification.success({ message: 'Page  ' + $scope.newPage.name + ' successfully created' });
                            setNewPage();
                            getPages();
                            $('#addPage').modal('hide');
                        } else Notification.error({ delay: 60000, message: 'Can\'t create page' });
                    });
            };

            function setNewPage() {
                $scope.newPage = {
                    name: '',
                    language: 'en',
                    content: 'New page',
                    portal_id: $stateParams.id
                }
            }

            $scope.changeMode = function() {
                delete $scope.portal.properties.free_mode;
                switch ($scope.portal.properties.mode) {
                    case 'free':
                        delete $scope.portal.properties.trial;
                        delete $scope.portal.properties.balance_threshold;
                        delete $scope.portal.properties.stop_delay;
                        break;
                    case 'balance':
                        delete $scope.portal.properties.trial;
                        break;
                    case 'subscription':
                        delete $scope.portal.properties.balance_threshold;
                        delete $scope.portal.properties.stop_delay;
                        break;
                }
            };

            setNewPage();

            function getPages() {
                pagesService
                    .getPages($stateParams.id)
                    .then(function(data) {
                        $scope.portalPages = data;
                    });
            }
            getPages();
        }
    ]);