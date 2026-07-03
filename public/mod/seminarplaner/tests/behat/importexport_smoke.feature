@mod @mod_seminarplaner
Feature: Seminarplaner activity smoke checks
  In order to ensure beta baseline behavior
  As a teacher
  I need to open a Seminarplaner activity and access core tabs.

  Background:
    Given the following "users" exist:
      | username | firstname | lastname | email |
      | teacher1 | Teacher   | One      | teacher1@example.com |
    And the following "courses" exist:
      | fullname | shortname | category |
      | KG Course | KGC      | 0        |
    And the following "course enrolments" exist:
      | user     | course | role           |
      | teacher1 | KGC    | editingteacher |
    And the following "activity" exists:
      | activity | seminarplaner |
      | course   | KGC              |
      | idnumber | kg-1             |
      | name     | KG Test          |

  Scenario: Teacher can open activity and see import/export tab
    Given I am on the "kg-1" "Activity" page logged in as teacher1
    Then I should see "Import/Export"
