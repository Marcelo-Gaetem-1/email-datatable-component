public without sharing class EmailDataTableController {

    public class EmailDTO {
        @AuraEnabled public String   id;
        @AuraEnabled public String   subject;
        @AuraEnabled public String   fromAddr;
        @AuraEnabled public String   toAddr;
        @AuraEnabled public Datetime sentDate;
        @AuraEnabled public String   body;
    }

    @AuraEnabled(cacheable=true)
    public static List<EmailDTO> getEmails(Id caseId) {
        String userType = UserInfo.getUserType();
        Set<String> externals = new Set<String>{
            'CSPLitePortal', 'PowerCustomerSuccess', 'CsnOnly', 'PowerPartner', 'HighVolumePortal', 'Guest'
        };
        Boolean isExternalUser = externals.contains(userType);

        Case cs = [
            SELECT Contact.Email
            FROM   Case
            WHERE  Id = :caseId
            LIMIT 1
        ];
        if (cs.Contact == null || String.isBlank(cs.Contact.Email)) return new List<EmailDTO>();

        String custEmailLike = '%' + cs.Contact.Email + '%';

        String soql =
            'SELECT Id, Subject, FromAddress, ToAddress, CcAddress, ' +
            '       MessageDate, HtmlBody ' +
            'FROM   EmailMessage ' +
            'WHERE  ParentId = :caseId AND IsExternallyVisible = TRUE AND Incoming = FALSE ';

        if (isExternalUser) {
            soql +=
            'AND (ToAddress LIKE :custEmailLike ' +
            'OR CcAddress LIKE :custEmailLike ' +
            'OR FromAddress LIKE :custEmailLike) ';
        }

        soql += 'ORDER BY MessageDate DESC LIMIT 500';

        List<EmailDTO> result = new List<EmailDTO>();
        for (EmailMessage em : Database.query(soql)) {
            EmailDTO dto = new EmailDTO();
            dto.id       = em.Id;
            dto.subject  = em.Subject;
            dto.fromAddr = em.FromAddress;
            dto.toAddr   = em.ToAddress;
            dto.sentDate = em.MessageDate;
            dto.body     = trimBody(em.HtmlBody);
            result.add(dto);
        }
        return result;
    }

    private static String trimBody(String html) {
        if (html == null) return '';
        Integer idx = html.indexOf('-----Original Message-----');
        return idx > 0 ? html.substring(0, idx) : html;
    }
}
